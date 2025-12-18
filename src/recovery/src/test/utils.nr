use crate::Recovery;
use aztec::protocol_types::address::AztecAddress;
use aztec::test::helpers::test_environment::TestEnvironment;

pub unconstrained fn setup_contract() -> (&mut TestEnvironment, AztecAddress, AztecAddress, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();

    let owner = env.create_light_account();
    let user = env.create_light_account();
    let user2 = env.create_light_account();

    let wormhole_address = deploy_wormhole_contract(&mut env);
    let contract_address = deploy_recovery_contract(&mut env, owner, wormhole_address);

    (&mut env, contract_address, owner, user, user2)
}

pub unconstrained fn deploy_wormhole_contract(env: &mut TestEnvironment) -> AztecAddress {
    let address = env.deploy("@dummyhole/DummyHole").without_initializer();
    address
}

pub unconstrained fn deploy_recovery_contract(
    env: &mut TestEnvironment,
    owner: AztecAddress,
    wormhole_address: AztecAddress,
) -> AztecAddress {
    let threshold = 3;
    let wormhole_message = default_wormhole_message();
    let initializer_call_interface =
        Recovery::interface().constructor(owner, wormhole_address, threshold, wormhole_message);

    let address = env.deploy("Recovery").with_public_initializer(owner, initializer_call_interface);

    address
}

pub unconstrained fn default_wormhole_message() -> [[u8; 31]; 7] {
    let mut dest_addr: [u8; 31] = [0; 31];
    // Ethereum address bytes (20 bytes): 0x009cbB8f91d392856Cb880d67c806Aa731E3d686
    dest_addr[0] = 0x00;
    dest_addr[1] = 0x9c;
    dest_addr[2] = 0xbB;
    dest_addr[3] = 0x8f;
    dest_addr[4] = 0x91;
    dest_addr[5] = 0xd3;
    dest_addr[6] = 0x92;
    dest_addr[7] = 0x85;
    dest_addr[8] = 0x6C;
    dest_addr[9] = 0xb8;
    dest_addr[10] = 0x80;
    dest_addr[11] = 0xd6;
    dest_addr[12] = 0x7c;
    dest_addr[13] = 0x80;
    dest_addr[14] = 0x6A;
    dest_addr[15] = 0xa7;
    dest_addr[16] = 0x31;
    dest_addr[17] = 0xE3;
    dest_addr[18] = 0xd6;
    dest_addr[19] = 0x86;

    let mut chain_id: [u8; 31] = [0; 31];
    chain_id[0] = 0x14; // Chain ID 10004 in little-endian (0x2714)
    chain_id[1] = 0x27;

    let zero_bytes: [u8; 31] = [0; 31];

    [dest_addr, chain_id, zero_bytes, zero_bytes, zero_bytes, zero_bytes, zero_bytes]
}
