mod config;
mod vote_note;
mod address_note;
pub mod test;

use dep::aztec::macros::aztec;

//BIG TODO!
//1. Think about which functions need to use NoteViewer https://docs.aztec.network/developers/reference/smart_contract_reference/storage/private_state#view_notes
//2. Use contract_library_method macro to inline code
//3. Merge notes together into single file
//4. Add portals.

#[aztec]
pub contract Recovery {
    use crate::config::Config;
    use crate::vote_note::VoteNote;

    use crate::address_note::AddressNote;
    use dep::aztec::keys::getters::get_public_keys;
    use dep::aztec::macros::{functions::{initializer, private, public}, storage::storage};
    use dep::aztec::messages::logs::note::encode_and_encrypt_note;
    use dep::aztec::note::note_interface::NoteProperties;
    use dep::aztec::oracle::debug_log::{debug_log, debug_log_format};
    use dep::aztec::prelude::{
        AztecAddress, EthAddress, Map, NoteGetterOptions, PrivateMutable, PrivateSet,
        PublicImmutable, SharedMutable,
    };
    use dep::aztec::protocol_types::traits::{Hash, ToField};
    use dep::aztec::utils::comparison::Comparator;
    use std::hash::pedersen_hash;

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
    fn constructor(owner: AztecAddress, portal: EthAddress, threshold: u32) {
        storage.config.initialize(Config { owner, portal });
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
        let caller = context.msg_sender();

        let config = storage.config.read();
        assert(caller == config.owner, "Not owner");

        assert(
            !Recovery::at(context.this_address()).is_address_in_contacts(address).call(&mut context)
                ,
            "Contact already exists",
        );

        let note = AddressNote::new(address, caller);

        storage.contacts.insert(note).emit(encode_and_encrypt_note(
            &mut context,
            config.owner,
            address,
        ));
    }

    #[private]
    fn remove_contact(address: AztecAddress) {
        let caller = context.msg_sender();

        let config = storage.config.read();
        assert(caller == config.owner, "Not owner");

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
        assert(
            Recovery::at(context.this_address()).is_address_in_contacts(caller).call(&mut context),
            "Caller is not a contact",
        );

        let owner = storage.config.read().owner;
        storage.votes.at(candidate).initialize(VoteNote::new(0, false, owner)).emit(
            encode_and_encrypt_note(&mut context, owner, owner),
        );
    }

    #[private]
    fn vote(candidate: EthAddress) {
        let caller = context.msg_sender();
        assert(
            Recovery::at(context.this_address()).is_address_in_contacts(caller).call(&mut context),
            "Caller is not a contact",
        );

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

        let portal = storage.config.read().portal;
        let content = candidate.to_field();
        context.message_portal(portal, content);
    }

    #[private]
    fn is_address_in_contacts(address: AztecAddress) -> bool {
        let notes = storage.contacts.get_notes(NoteGetterOptions::new().select(
            AddressNote::properties().address,
            Comparator.EQ,
            address,
        ));

        notes.len() > 0
    }

    #[private]
    fn get_note_by_address(address: AztecAddress) -> Option<AddressNote> {
        let notes = storage.contacts.get_notes(NoteGetterOptions::new().select(
            AddressNote::properties().address,
            Comparator.EQ,
            address,
        ));

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

}
