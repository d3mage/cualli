use crate::Recovery;
use aztec::protocol_types::{address::{AztecAddress, EthAddress}, traits::FromField};
use aztec::test::helpers::test_environment::TestEnvironment;

pub unconstrained fn setup_contract() -> (&mut TestEnvironment, AztecAddress, AztecAddress, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();

    let owner = env.create_light_account();
    let user = env.create_light_account();
    let user2 = env.create_light_account();
    let wormhole_address = AztecAddress::from_field(4);

    let contract_address = deploy_recovery_contract(&mut env, owner, wormhole_address);

    (&mut env, contract_address, owner, user, user2)
}

pub unconstrained fn deploy_recovery_contract(
    env: &mut TestEnvironment,
    owner: AztecAddress,
    wormhole_address: AztecAddress,
) -> AztecAddress {
    let threshold = 3;
    let initializer_call_interface =
        Recovery::interface().constructor(owner, wormhole_address, threshold);

    let address = env.deploy("Recovery").with_public_initializer(owner, initializer_call_interface);

    address
}
