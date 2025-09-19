mod config;
mod notes;
pub mod test;

use dep::aztec::macros::aztec;

#[aztec]
pub contract Recovery {
    use crate::config::Config;
    use crate::notes::{AddressNote, VoteNote};
    use dep::aztec::context::PrivateContext;
    use dep::aztec::keys::getters::get_public_keys;
    use dep::aztec::macros::{functions::{initializer, private, public}, storage::storage};
    use dep::aztec::messages::logs::note::encode_and_encrypt_note;
    use dep::aztec::note::note_interface::NoteProperties;
    use dep::aztec::note::retrieved_note::RetrievedNote;
    use dep::aztec::prelude::{
        AztecAddress, EthAddress, Map, NoteGetterOptions, PrivateMutable, PrivateSet,
        PublicImmutable, SharedMutable,
    };
    use dep::aztec::protocol_types::traits::{Hash, ToField};
    use dep::aztec::utils::comparison::Comparator;
    use std::hash::pedersen_hash;

    use dep::dummyhole::DummyHole;
    // use dep::wormhole::Wormhole;

    pub(crate) global CHANGE_AUTHORIZED_DELAY: u64 = 180;

    #[storage]
    struct Storage<Context> {
        config: PublicImmutable<Config, Context>,
        threshold: SharedMutable<u32, CHANGE_AUTHORIZED_DELAY, Context>,
        contacts: PrivateSet<AddressNote, Context>,
        votes: Map<EthAddress, PrivateMutable<VoteNote, Context>, Context>, //afaik this leaks candidates
    }

    #[public]
    #[initializer]
    fn constructor(owner: AztecAddress, wormhole_address: AztecAddress, threshold: u32) {
        storage.config.initialize(Config { owner, wormhole_address });
        storage.threshold.schedule_value_change(threshold);
    }

    #[public]
    fn set_threshold(threshold: u32) {
        let caller = context.msg_sender();

        let config = storage.config.read();
        assert(caller == config.owner, "Not owner");

        storage.threshold.schedule_value_change(threshold);
    }

    #[private]
    fn add_contact(address: AztecAddress) {
        let (owner, caller) = is_owner_macro(&mut context);
        assert(!is_address_in_contacts_macro(&mut context, address), "Contact already exists");

        let note = AddressNote::new(address, caller);

        storage.contacts.insert(note).emit(encode_and_encrypt_note(&mut context, owner, address));
    }

    #[private]
    fn remove_contact(address: AztecAddress) {
        let (owner, caller) = is_owner_macro(&mut context);

        let notes = storage.contacts.pop_notes(NoteGetterOptions::new().select(
            AddressNote::properties().address,
            Comparator.EQ,
            address,
        ));

        assert(notes.len() > 0, "Contact not found");
    }

    #[private]
    fn start_vote(candidate: EthAddress) {
        let caller = context.msg_sender();
        assert(is_address_in_contacts_macro(&mut context, caller), "Caller is not a contact");

        let owner = storage.config.read().owner;
        storage.votes.at(candidate).initialize(VoteNote::new(0, false, owner)).emit(
            encode_and_encrypt_note(&mut context, owner, owner),
        );
    }

    #[private]
    fn vote(candidate: EthAddress) {
        let caller = context.msg_sender();
        assert(is_address_in_contacts_macro(&mut context, caller), "Caller is not a contact");

        let msg_sender_npk_m_hash = get_public_keys(caller).npk_m.hash();
        let secret = context.request_nsk_app(msg_sender_npk_m_hash);
        let nullifier = pedersen_hash([caller.to_field(), candidate.to_field(), secret]);
        context.push_nullifier(nullifier);

        let vote_note = storage.votes.at(candidate).get_note().note;
        let votes = vote_note.votes + 1;

        let threshold = storage.threshold.get_current_value();
        let mut finished = false;
        if votes as u32 >= threshold {
            finished = true;
        }

        let owner = storage.config.read().owner;
        storage.votes.at(candidate).replace(VoteNote::new(votes, finished, owner)).emit(
            encode_and_encrypt_note(&mut context, owner, owner),
        );

        // if finished {
        //     send_wormhole_message_macro(&mut context, candidate);
        // }
    }

    #[private]
    fn is_address_in_contacts(address: AztecAddress) -> bool {
        is_address_in_contacts_macro(&mut context, address)
    }

    #[private]
    fn get_note_by_address(address: AztecAddress) -> Option<AddressNote> {
        let notes = collect_notes_by_address_macro(&mut context, address);
        if notes.len() > 0 {
            Option::some(notes.get(0).note)
        } else {
            Option::none()
        }
    }

    #[private]
    fn get_votes_by_candidate(candidate: EthAddress) -> u32 {
        let vote_note = storage.votes.at(candidate).get_note().note;
        vote_note.votes as u32
    }

    #[private]
    fn contacts_length() -> u32 {
        let mut options = NoteGetterOptions::new();
        let notes = storage.contacts.get_notes(options);
        notes.len() as u32
    }

    #[public]
    fn get_threshold() -> u32 {
        storage.threshold.get_current_value()
    }

    #[contract_library_method]
    fn is_owner_macro(context: &mut PrivateContext) -> (AztecAddress, AztecAddress) {
        let storage = Storage::init(context);
        let config = storage.config.read();
        let owner = config.owner;
        let caller = context.msg_sender();

        assert(caller == owner, "Not owner");
        (owner, caller)
    }

    // //TODO: remove this macro
    // #[private]
    // fn send_wormhole_message(address: EthAddress, msg: [[u8;31];7], wormhole_address: AztecAddress,
    //     token_address: AztecAddress, // address of the token to be donated
    //     amount: u128, // amount of tokens to be donated on chosen chainID
    //     nonce: Field) {
    //     send_wormhole_message_macro(&mut context, address);
    // }

    #[public]
    fn send_wormhole_message(
        candidate: EthAddress,
        msg: [[u8;31];7],             // [destination address, destination chain id, msg1, msg2, msg3, msg4, msg5]
        wormhole_address: AztecAddress,
        token_nonce: Field
    ) {
        // Convert candidate EthAddress into a 31-byte payload
        let candidate_field: Field = candidate.to_field();
        let candidate_bytes: [u8; 31] = candidate_field.to_le_bytes();

        // Build the 8;31 Wormhole payload: 
        // destination addr, chain id, amount, candidate, and 4 spare slots for extension
        let wormhole_payload: [[u8;31];8] = [
            msg[0],         // destination address
            msg[1],         // chain id
            candidate_bytes,   // candidate
            msg[2], // random payload
            msg[3], // random payload
            msg[4], // random payload
            msg[5], // random payload
            msg[6], // random payload
        ];

        let nonce = 1;
        let message_fee: u128 = 1;
        let consistency: u8 = 2;
        let from = context.msg_sender();

        let _ = DummyHole::at(wormhole_address).publish_message_in_public(
            nonce,
            wormhole_payload,
            message_fee,
            consistency,
            from,
            token_nonce,
        ).call(&mut context);
}

    // #[contract_library_method]
    // fn send_wormhole_message_macro(context: &mut PrivateContext, candidate: EthAddress) {
        //We prepare a payload for the wormhole message that has the following format:
        //Payload[0] = destination chain ID
        //Payload[1] = destination address
        //Payload[2] = candidate address

        // let storage = Storage::init(context);

        // let destination_chain_id_payload: [u8; 31] = [0; 31];
        // //TODO: create functions to setup destination address as a payload and read it
        // let destination_address_payload: [u8; 31] = candidate.to_le_bytes();
        // let receiver_payload: [u8; 31] = candidate.to_le_bytes();

        // let payload = [destination_chain_id_payload, destination_address_payload, receiver_payload];

        // let wormhole_address = storage.config.read().wormhole_address;
        // let wormhole = Wormhole::at(wormhole_address);

        // let nonce = 15;
        // let consistency = 1;
        // wormhole.publish_message_in_private(nonce, payload, consistency);
    // }

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
        let notes = storage.contacts.get_notes(NoteGetterOptions::new().select(
            AddressNote::properties().address,
            Comparator.EQ,
            address,
        ));

        notes
    }

}
