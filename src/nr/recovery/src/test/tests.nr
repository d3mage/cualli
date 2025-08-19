use crate::{Recovery, test::utils};

#[test]
unconstrained fn add_contact_success() {
    let (env, contract_address, owner, user) = utils::setup_contract(false);

    env.impersonate(owner);
    let recovery_contract = Recovery::at(contract_address);
    recovery_contract.add_contact(user).call(&mut env.private());

    let is_in_contacts = recovery_contract.is_address_in_contacts(user).call(&mut env.private());
    assert(is_in_contacts, "User should be in contacts");

    let contacts_length = recovery_contract.contacts_length().call(&mut env.private());
    assert(contacts_length == 1, "Contacts length should be 1");
}

#[test(should_fail_with = "Not owner")]
unconstrained fn add_contact_user_failure() {
    let (env, contract_address, _, user) = utils::setup_contract(false);

    env.impersonate(user);
    let recovery_contract = Recovery::at(contract_address);
    recovery_contract.add_contact(user).call(&mut env.private());
}

#[test]
unconstrained fn set_threshold_success() {
    let (env, contract_address, owner, _) = utils::setup_contract(false);

    // Treshold is not set
    env.impersonate(owner);
    let recovery_contract = Recovery::at(contract_address);
    let thrershold0 = recovery_contract.get_threshold().call(&mut env.public());
    assert(thrershold0 == 0, "Threshold should be 3");

    // Threshold set in init function
    env.advance_timestamp_by(180);
    let thrershold1 = recovery_contract.get_threshold().call(&mut env.public());
    assert(thrershold1 == 3, "Threshold should be 3");

    // Threshold set by owner
    recovery_contract.set_threshold(2).call(&mut env.public());
    env.advance_timestamp_by(180);
    let thrershold2 = recovery_contract.get_threshold().call(&mut env.public());
    assert(thrershold2 == 2, "Threshold should be 3");


}