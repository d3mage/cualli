use crate::{Recovery, address_note::AddressNote, test::utils};

#[test]
unconstrained fn add_contact_success() {
    let (env, contract_address, owner, user) = utils::setup_contract(false);
    let recovery_contract = Recovery::at(contract_address);

    env.impersonate(owner);
    recovery_contract.add_contact(user).call(&mut env.private());

    let is_in_contacts = recovery_contract.is_address_in_contacts(user).call(&mut env.private());
    assert(is_in_contacts, "User should be in contacts");

    let contacts_length = recovery_contract.contacts_length().call(&mut env.private());
    assert(contacts_length == 1, "Contacts length should be 1");
}

#[test(should_fail_with = "Not owner")]
unconstrained fn add_contact_user_failure() {
    let (env, contract_address, _, user) = utils::setup_contract(false);
    let recovery_contract = Recovery::at(contract_address);

    env.impersonate(user);
    recovery_contract.add_contact(user).call(&mut env.private());
}

#[test]
unconstrained fn set_threshold_success() {
    let (env, contract_address, owner, _) = utils::setup_contract(false);
    let recovery_contract = Recovery::at(contract_address);

    // Treshold is not set
    env.impersonate(owner);
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

#[test]
unconstrained fn get_note_by_address_success() {
    let (env, contract_address, owner, user) = utils::setup_contract(false);
    let recovery_contract = Recovery::at(contract_address);
    
    let note = recovery_contract.get_note_by_address(user).call(&mut env.private());
    assert(note.is_none(), "Note should be None initially");
    
    env.impersonate(owner);
    recovery_contract.add_contact(user).call(&mut env.private());

    let note = recovery_contract.get_note_by_address(user).call(&mut env.private());
    assert(note.is_some(), "Note should be Some");
    assert(note.unwrap().address == user, "Note should be the same as the user");
}
