mod config;
mod notes;
pub mod test;

use aztec::macros::aztec;

#[aztec]
pub contract Recovery {
    use crate::config::Config;
    use crate::notes::{AddressNote, VoteNote};

    use aztec::context::PrivateContext;
    use aztec::keys::getters::get_public_keys;
    use aztec::macros::functions::{external, initializer};
    use aztec::macros::storage::storage;
    use aztec::messages::message_delivery::MessageDelivery;
    use aztec::note::{
        note_getter_options::NoteGetterOptions, note_interface::NoteProperties,
        retrieved_note::RetrievedNote,
    };
    use aztec::protocol_types::{address::{AztecAddress, EthAddress}, traits::{Hash, ToField}};
    use aztec::state_vars::{
        delayed_public_mutable::DelayedPublicMutable, map::Map, private_mutable::PrivateMutable,
        private_set::PrivateSet, public_immutable::PublicImmutable, public_mutable::PublicMutable,
    };
    use aztec::utils::comparison::Comparator;

    use std::hash::pedersen_hash;

    use wormhole::Wormhole;

    pub(crate) global CHANGE_AUTHORIZED_DELAY: u64 = 180;

    #[storage]
    struct Storage<Context> {
        config: PublicImmutable<Config, Context>,
        threshold: DelayedPublicMutable<u32, CHANGE_AUTHORIZED_DELAY, Context>,
        contacts: PrivateSet<AddressNote, Context>,
        votes: Map<EthAddress, PrivateMutable<VoteNote, Context>, Context>,
        nonce: PublicMutable<u64, Context>,
    }

    #[initializer]
    #[external("public")]
    fn constructor(
        owner: AztecAddress,
        wormhole_address: AztecAddress,
        threshold: u32,
        wormhole_message: [[u8; 31]; 7],
    ) {
        storage.config.initialize(Config { owner, wormhole_address, wormhole_message });
        storage.threshold.schedule_value_change(threshold);
        storage.nonce.write(0);
    }

    #[external("public")]
    fn set_threshold(threshold: u32) {
        let caller = context.msg_sender().unwrap();

        let config = storage.config.read();
        assert(caller == config.owner, "Not owner");

        storage.threshold.schedule_value_change(threshold);
    }

    #[external("private")]
    fn add_contact(address: AztecAddress) {
        let (owner, caller) = is_owner_macro(&mut context);
        assert(!is_address_in_contacts_macro(&mut context, address), "Contact already exists");

        let note = AddressNote::new(address, caller);
        storage.contacts.insert(note).emit(owner, MessageDelivery.CONSTRAINED_ONCHAIN);
    }

    #[external("private")]
    fn remove_contact(address: AztecAddress) {
        let (_, _caller) = is_owner_macro(&mut context);

        let notes = storage.contacts.pop_notes(NoteGetterOptions::new().select(
            AddressNote::properties().address,
            Comparator.EQ,
            address,
        ));

        assert(notes.len() > 0, "Contact not found");
    }

    #[external("private")]
    fn start_vote(candidate: EthAddress) {
        let caller = context.msg_sender().unwrap();
        assert(is_address_in_contacts_macro(&mut context, caller), "Caller is not a contact");

        let owner = storage.config.read().owner;
        storage.votes.at(candidate).initialize(VoteNote::new(0, false, owner)).emit(
            owner,
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );
    }

    #[external("private")]
    fn vote(candidate: EthAddress) {
        let caller = context.msg_sender().unwrap();
        assert(is_address_in_contacts_macro(&mut context, caller), "Caller is not a contact");

        let msg_sender_npk_m_hash = get_public_keys(caller).npk_m.hash();
        let secret = context.request_nsk_app(msg_sender_npk_m_hash);
        let nullifier = pedersen_hash([caller.to_field(), candidate.to_field(), secret]);
        context.push_nullifier(nullifier);

        let threshold = storage.threshold.get_current_value();
        let owner = storage.config.read().owner;

        storage
            .votes
            .at(candidate)
            .replace(|vote_note| {
                let votes = vote_note.get_votes() + 1;
                let mut finished = false;
                if votes as u32 >= threshold {
                    finished = true;
                }
                VoteNote::new(votes, finished, owner)
            })
            .emit(owner, MessageDelivery.CONSTRAINED_ONCHAIN);

        // if finished {
        //     send_wormhole_message_macro(&mut context, candidate);
        // }
    }

    #[external("private")]
    fn is_address_in_contacts(address: AztecAddress) -> bool {
        is_address_in_contacts_macro(&mut context, address)
    }

    #[external("private")]
    fn get_note_by_address(address: AztecAddress) -> Option<AddressNote> {
        let notes = collect_notes_by_address_macro(&mut context, address);
        if notes.len() > 0 {
            Option::some(notes.get(0).note)
        } else {
            Option::none()
        }
    }

    #[external("private")]
    fn get_votes_by_candidate(candidate: EthAddress) -> u32 {
        let emission = storage.votes.at(candidate).get_note();
        let vote_note = emission.content.note;
        vote_note.get_votes() as u32
    }

    #[external("private")]
    fn contacts_length() -> u32 {
        let notes = storage.contacts.get_notes(NoteGetterOptions::new());
        notes.len() as u32
    }

    #[external("public")]
    fn get_threshold() -> u32 {
        storage.threshold.get_current_value()
    }

    #[contract_library_method]
    fn is_owner_macro(context: &mut PrivateContext) -> (AztecAddress, AztecAddress) {
        let storage = Storage::init(context);
        let config = storage.config.read();
        let owner = config.owner;
        let caller = context.msg_sender().unwrap();

        assert(caller == owner, "Not owner");
        (owner, caller)
    }

    #[external("public")]
    fn send_wormhole_message(candidate: EthAddress) {
        let config = storage.config.read();
        let wormhole_address = config.wormhole_address;
        let msg = config.wormhole_message;
        let nonce: u64 = storage.nonce.read();

        let candidate_field: Field = candidate.to_field();
        let candidate_bytes: [u8; 31] = candidate_field.to_le_bytes();

        let wormhole_payload: [[u8; 31]; 8] =
            [msg[0], msg[1], candidate_bytes, msg[2], msg[3], msg[4], msg[5], msg[6]];

        let message_fee: u128 = 0;
        let consistency: u8 = 2;
        let from = context.msg_sender().unwrap();
        let token_nonce = 0;

        let _ = Wormhole::at(wormhole_address)
            .publish_message_in_public(
                nonce,
                wormhole_payload,
                message_fee,
                consistency,
                from,
                token_nonce,
            )
            .call(&mut context);

        storage.nonce.write(nonce + 1);
    }

    #[external("public")]
    fn get_nonce() -> u64 {
        storage.nonce.read()
    }

    #[contract_library_method]
    fn is_address_in_contacts_macro(context: &mut PrivateContext, address: AztecAddress) -> bool {
        let notes = collect_notes_by_address_macro(context, address);
        notes.len() > 0
    }

    #[contract_library_method]
    fn collect_notes_by_address_macro(
        context: &mut PrivateContext,
        address: AztecAddress,
    ) -> BoundedVec<RetrievedNote<AddressNote>, 16> {
        let storage = Storage::init(context);
        storage.contacts.get_notes(NoteGetterOptions::new().select(
            AddressNote::properties().address,
            Comparator.EQ,
            address,
        ))
    }
}
