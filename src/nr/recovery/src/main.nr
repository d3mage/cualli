mod config;
mod vote_note;
mod address_note;
pub mod test;

use dep::aztec::macros::aztec;

//BIG TODO! 
//1. Think about which functions need to use NoteViewer https://docs.aztec.network/developers/reference/smart_contract_reference/storage/private_state#view_notes
//2.

#[aztec]
pub contract Recovery {
    use crate::config::Config;
    use crate::vote_note::VoteNote;

    use crate::address_note::AddressNote;
    use dep::aztec::macros::{functions::{initializer, private, public}, storage::storage};
    use dep::aztec::messages::logs::note::encode_and_encrypt_note;
    use dep::aztec::note::note_interface::NoteProperties;
    use dep::aztec::oracle::debug_log::{debug_log, debug_log_format};
    use dep::aztec::prelude::{
        AztecAddress, EthAddress, PrivateSet, PublicImmutable, PublicMutable, SharedMutable,
    };
    use dep::aztec::prelude::NoteGetterOptions;
    use dep::aztec::utils::comparison::Comparator;

    pub(crate) global CHANGE_AUTHORIZED_DELAY: u64 = 180;

    #[storage]
    struct Storage<Context> {
        config: PublicImmutable<Config, Context>,
        contacts: PrivateSet<AddressNote, Context>,
        votes: PrivateSet<VoteNote, Context>,
        vote_ended: PublicMutable<bool, Context>,
        threshold: SharedMutable<u32, CHANGE_AUTHORIZED_DELAY, Context>,
    }

    #[public]
    #[initializer]
    fn constructor(owner: AztecAddress, portal: EthAddress, threshold: u32) {
        storage.config.initialize(Config { owner, portal });
        storage.threshold.schedule_value_change(threshold);
    }

    #[private]
    fn add_contact(address: AztecAddress) {
        let caller = context.msg_sender();

        let config = storage.config.read();
        assert(caller == config.owner, "Not owner");

        //TODO: check if contact already exists
        storage.contacts.insert(note).emit(encode_and_encrypt_note(
            &mut context,
            config.owner,
            address,
        ));
    }

    #[public]
    fn set_threshold(threshold: u32) {
        let caller = context.msg_sender();

        let config = storage.config.read();
        assert(caller == config.owner, "Not owner");

        storage.threshold.schedule_value_change(threshold);
    }

    #[public]
    fn get_threshold() -> u32 {
        storage.threshold.get_current_value()
    }

    #[private]
    fn remove_contact(address: AztecAddress) {
        let caller = context.msg_sender();

        let config = storage.config.read();
        assert(caller == config.owner, "Not owner");

        //TODO:
        //1. find notes
        //2. pop found notes, but with the first todo, we should have only one note

    }

    #[private]
    fn start_vote(candidate: EthAddress) {
        //TODO:
        //1. check if voter is in contacts
        //2. check if vote with this candidate already exists
        //3. create a new note with vote
        //4. optional: maybe send a note to each contact to vote?
    }

    #[private]
    fn vote(candidate: EthAddress) {
        //TODO:
        //1. check if voter is in contacts
        //2. nullify the note or something
        //3. check if threshold
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
    fn contacts_length() -> u32 {
        let mut options = NoteGetterOptions::new();
        let notes = storage.contacts.get_notes(options);
        notes.len() as u32
    }

}
