use dep::aztec::macros::aztec;

#[aztec]
pub contract DummyHole {
    use dep::aztec::{
        macros::{functions::{internal, private, public}, storage::storage},
        prelude::{AztecAddress, Map, PublicMutable},
        protocol_types::traits::ToField,
    };

    #[storage]
    struct Storage<Context> {
        sequences: Map<AztecAddress, PublicMutable<u64, Context>, Context>,
    }

    #[private]
    fn publish_message_in_private(
        nonce: u64,
        payloads: [[u8; 31]; 3],
        consistency: u8
    ) {
        DummyHole::at(context.this_address())
            ._publish_message(nonce, payloads, consistency)
            .enqueue(&mut context);
    }

    #[public]
    #[internal]
    fn _publish_message(nonce: u64, payloads: [[u8; 31]; 3], consistency: u8) -> u64 {
        let sequence = storage.sequences.at(context.msg_sender()).read();
        storage.sequences.at(context.msg_sender()).write(sequence + 1);

        let msg: [Field; 8] = [
            context.msg_sender().to_field(),
            sequence as Field,
            nonce as Field,
            consistency as Field,
            context.timestamp() as Field,
            Field::from_le_bytes(payloads[0]),
            Field::from_le_bytes(payloads[1]),
            Field::from_le_bytes(payloads[2]),
        ];

        context.emit_public_log(msg);
        sequence
    }
}
