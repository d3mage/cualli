use crate::{Recovery, test::utils};

#[test]
unconstrained fn add_contact_success() {
    let (env, contract_address, owner, user) = utils::setup_contract(false);

    env.impersonate(owner);
    let recovery_contract = Recovery::at(contract_address);
    recovery_contract.add_contact(user).call(&mut env.private());

    let is_in_contacts = recovery_contract.is_address_in_contacts(user).call(&mut env.private());
    assert(is_in_contacts, "User should be in contacts");
}
