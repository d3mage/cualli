use aztec::macros::aztec;

#[aztec]
contract DummyHole {
    use aztec::{
        macros::{functions::{internal, private, public}, storage::storage},
        protocol_types::{address::AztecAddress, traits::ToField},
        state_vars::{map::Map, public_mutable::PublicMutable},
    };

    #[storage]
    struct Storage<Context> {
        sequences: Map<AztecAddress, PublicMutable<u64, Context>, Context>,
    }

    #[private]
    fn publish_message_in_private(nonce: u64, payloads: [[u8; 31]; 8], consistency: u8) {
        DummyHole::at(context.this_address())
            ._publish_message(nonce, payloads, consistency)
            .enqueue(&mut context);
    }

    #[public]
    #[internal]
    fn _publish_message(nonce: u64, payloads: [[u8; 31]; 8], consistency: u8) -> u64 {
        let sequence = storage.sequences.at(context.msg_sender()).read();
        storage.sequences.at(context.msg_sender()).write(sequence + 1);

        let msg: [Field; 13] = [
            context.msg_sender().to_field(),
            sequence as Field,
            nonce as Field,
            consistency as Field,
            context.timestamp() as Field,
            Field::from_le_bytes(payloads[0]),
            Field::from_le_bytes(payloads[1]),
            Field::from_le_bytes(payloads[2]),
            Field::from_le_bytes(payloads[3]),
            Field::from_le_bytes(payloads[4]),
            Field::from_le_bytes(payloads[5]),
            Field::from_le_bytes(payloads[6]),
            Field::from_le_bytes(payloads[7]),
        ];

        context.emit_public_log(msg);
        sequence
    }
}
