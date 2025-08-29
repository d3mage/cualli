use crate::Recovery;
use aztec::{
    prelude::{AztecAddress, EthAddress},
    protocol_types::contract_instance::ContractInstance,
    test::helpers::test_environment::TestEnvironment,
};

pub unconstrained fn setup_contract(
    with_account_contracts: bool,
) -> (&mut TestEnvironment, AztecAddress, AztecAddress, AztecAddress, AztecAddress) {
    // Setup env, generate keys
    let mut env = TestEnvironment::new();
    let (owner, user, user2) = if with_account_contracts {
        let owner = env.create_account_contract(1);
        let user = env.create_account_contract(2);
        let user2 = env.create_account_contract(3);
        (owner, user, user2)
    } else {
        let owner = env.create_account(1);
        let user = env.create_account(2);
        let user2 = env.create_account(3);
        (owner, user, user2)
    };

    let wormhole_address = env.create_account(4);
    let acontract = deploy_recovery_contract(&mut env, owner, wormhole_address);

    (&mut env, acontract.to_address(), owner, user, user2)
}

pub unconstrained fn deploy_recovery_contract(
    env: &mut TestEnvironment,
    owner: AztecAddress,
    wormhole_address: AztecAddress,
) -> ContractInstance {
    let threshold = 3;
    let initializer_call_interface = Recovery::interface().constructor(owner, wormhole_address, threshold);
    let contract_instance = env.deploy("./@recovery", "Recovery").with_public_void_initializer(
        owner,
        initializer_call_interface,
    );
    env.advance_block_by(1);

    contract_instance
}
