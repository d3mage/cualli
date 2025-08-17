mod config;
mod vote_note;

use dep::aztec::macros::aztec;

#[aztec]
pub contract NulWallet {
    use crate::config::Config;

    use dep::address_note::address_note::AddressNote;
    use dep::aztec::context::PrivateContext;
    use dep::aztec::macros::{functions::{initializer, private, public, view}, storage::storage};
    use dep::aztec::messages::logs::note::encode_and_encrypt_note;
    use dep::aztec::note::note_interface::NoteProperties;
    use dep::aztec::note::note_viewer_options::NoteViewerOptions;
    use dep::aztec::oracle::debug_log::{debug_log, debug_log_format};
    use dep::aztec::prelude::{AztecAddress, EthAddress, PrivateSet, PublicImmutable, PublicMutable};
    use dep::aztec::prelude::NoteGetterOptions;
    use dep::aztec::protocol_types::traits::ToField;
    use dep::aztec::utils::comparison::Comparator;

    use crate::vote_note::VoteNote;

    #[storage]
    struct Storage<Context> {
        config: PublicImmutable<Config, Context>,
        contacts: PrivateSet<AddressNote, Context>,
        votes: PrivateSet<VoteNote, Context>,
        vote_ended: PublicMutable<bool, Context>,
    }

    #[public]
    #[initializer]
    fn constructor(owner: AztecAddress, portal: EthAddress) {
        storage.config.initialize(Config { owner, portal });
    }

    #[private]
    fn add_contact(address: AztecAddress) {
        let caller = context.msg_sender();

        let config = storage.config.read();
        assert(caller == config.owner, "Only the contract owner can add contacts");

        let note = AddressNote::new(address, caller);
        storage.contacts.insert(note).emit(encode_and_encrypt_note(
            &mut context,
            config.owner,
            address,
        ));
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
    fn contacts_length() -> u32 {
        let mut options = NoteGetterOptions::new();
        options.limit = 10;
        let notes = storage.contacts.get_notes(options);

        notes.len() as u32
    }

}
