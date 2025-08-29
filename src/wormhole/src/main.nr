use dep::aztec::macros::aztec;
mod structs;

#[aztec]
pub contract DummyHole {
    use crate::structs::{Guardian, Provider, Signature, WormholeStorage};
    use dep::keccak256::keccak256;

    use dep::aztec::{
        macros::{functions::{initializer, internal, private, public, utility}, storage::storage},
        prelude::{AztecAddress, Map, PublicMutable},
        protocol_types::traits::ToField,
    };

    use dep::token::Token;

    #[storage]
    struct Storage<Context> {
        state: PublicMutable<WormholeStorage, Context>,
        sequences: Map<AztecAddress, PublicMutable<u64, Context>, Context>,
        wormhole_address: PublicMutable<AztecAddress, Context>,
        token_address: PublicMutable<AztecAddress, Context>,
        current_guardian_set_index: Map<u32, PublicMutable<u64, Context>, Context>,
    }

    #[public]
    #[initializer]
    fn init(
        chain_id: u16,
        evm_chain_id: u16,
        wormhole_address: AztecAddress,
        token_address: AztecAddress,
    ) {
        let provider: Provider = Provider { chain_id, evm_chain_id };
        storage.state.write(WormholeStorage::init(provider));
        storage.wormhole_address.write(wormhole_address);
        storage.token_address.write(token_address);
        storage.current_guardian_set_index.at(0).write(18_446_744_073_709_551_615);
    }

    #[private]
    fn publish_message_in_private(
        nonce: u64,
        payloads: [[u8; 31]; 8],
        message_fee: u128,
        consistency: u8,
        from: AztecAddress,
        token_nonce: Field,
    ) {
        assert(1 <= message_fee, "insufficient fee");

        let receiver_address = AztecAddress {
            inner: 0x2f73c9b19222c2a7931c6cba01eedbbabb51e01b405fe4e0cabe0de91c275d0e,
        };
        let token_address = AztecAddress {
            inner: 0x13babb369e8c237a78ed507fe7cc44336a5178ffd02312a979c1fa0921f02a06,
        };

        let _ = Token::at(token_address)
            .transfer_in_private(from, receiver_address, message_fee, token_nonce)
            .call(&mut context);

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
