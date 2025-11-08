use aztec::macros::aztec;

//Stripped down version of https://github.com/NethermindEth/wormhole/blob/aztec/aztec/contracts/src/main.nr

#[aztec]
pub contract DummyHole {
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
    fn publish_message_in_public(
        nonce: u64,
        payloads: [[u8; 31]; 8],
        message_fee: u128,
        consistency: u8,
        from: AztecAddress,
        token_nonce: Field,
    ) -> u64 {
        let sequence = storage.sequences.at(from).read();
        storage.sequences.at(from).write(sequence + 1);

        let msg: [Field; 13] = [
            from.to_field(),
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

    #[public]
    #[internal]
    fn _publish_message(nonce: u64, payloads: [[u8; 31]; 8], consistency: u8) -> u64 {
        let sequence = storage.sequences.at(context.msg_sender().unwrap()).read();
        storage.sequences.at(context.msg_sender()).write(sequence + 1);

        let msg: [Field; 13] = [
            context.msg_sender().unwrap().to_field(),
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
