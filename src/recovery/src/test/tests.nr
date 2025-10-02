use crate::{Recovery, test::utils};

use aztec::protocol_types::{address::{EthAddress}, traits::FromField};

#[test]
unconstrained fn add_contact_success() {
    let (env, contract_address, owner, user, _) = utils::setup_contract();
    let recovery_contract = Recovery::at(contract_address);

    env.call_private(owner, recovery_contract.add_contact(user));

    let is_in_contacts = env.call_private(user, recovery_contract.is_address_in_contacts(user));
    assert(is_in_contacts, "User should be in contacts");

    let contacts_length = env.call_private(user, recovery_contract.contacts_length());
    assert(contacts_length == 1, "Contacts length should be 1");
}

#[test(should_fail_with = "Not owner")]
unconstrained fn add_contact_user_failure() {
    let (env, contract_address, _, user, _) = utils::setup_contract();
    let recovery_contract = Recovery::at(contract_address);

    env.call_private(user, recovery_contract.add_contact(user));
}

#[test(should_fail_with = "Contact already exists")]
unconstrained fn add_contact_already_exists_failure() {
    let (env, contract_address, owner, user, _) = utils::setup_contract();
    let recovery_contract = Recovery::at(contract_address);

    env.call_private(owner, recovery_contract.add_contact(user));
    env.call_private(owner, recovery_contract.add_contact(user));
}

#[test]
unconstrained fn remove_contact_success() {
    let (env, contract_address, owner, user, _) = utils::setup_contract();
    let recovery_contract = Recovery::at(contract_address);

    env.call_private(owner, recovery_contract.add_contact(user));
    let is_in_contacts = env.call_private(user, recovery_contract.is_address_in_contacts(user));
    assert(is_in_contacts, "User should be in contacts");

    env.call_private(owner, recovery_contract.remove_contact(user));
    let is_in_contacts = env.call_private(user, recovery_contract.is_address_in_contacts(user));
    assert(!is_in_contacts, "User should not be in contacts");
}

#[test]
unconstrained fn set_threshold_success() {
    let (env, contract_address, owner, _, _) = utils::setup_contract();
    let recovery_contract = Recovery::at(contract_address);

    // Treshold is not set
    let thrershold0 = env.call_public(owner, recovery_contract.get_threshold());
    assert(thrershold0 == 0, "Threshold should be 3");

    // Threshold set in init function
    env.advance_next_block_timestamp_by(180);
    let thrershold1 = env.call_public(owner, recovery_contract.get_threshold());
    assert(thrershold1 == 3, "Threshold should be 3");

    // Threshold set by owner
    env.call_public(owner, recovery_contract.set_threshold(2));
    env.advance_next_block_timestamp_by(180);
    let thrershold2 = env.call_public(owner, recovery_contract.get_threshold());
    assert(thrershold2 == 2, "Threshold should be 3");
}

#[test]
unconstrained fn get_note_by_address_success() {
    let (env, contract_address, owner, user, _) = utils::setup_contract();
    let recovery_contract = Recovery::at(contract_address);

    let note = env.call_private(owner, recovery_contract.get_note_by_address(user));
    assert(note.is_none(), "Note should be None initially");

    env.call_private(owner, recovery_contract.add_contact(user));

    let note = env.call_private(owner, recovery_contract.get_note_by_address(user));
    assert(note.is_some(), "Note should be Some");
    assert(note.unwrap().get_address() == user, "Note should be the same as the user");
}

#[test]
unconstrained fn start_vote_success() {
    let (env, contract_address, owner, user, _) = utils::setup_contract();
    let recovery_contract = Recovery::at(contract_address);

    let candidate = Field::from(0x000000000000000000000000000000000000dead);
    let candidate_address = EthAddress::from_field(candidate);

    env.call_private(owner, recovery_contract.add_contact(user));

    env.mine_block();
    let is_in_contacts = env.call_private(owner, recovery_contract.is_address_in_contacts(user));
    assert(is_in_contacts, "User should be in contacts");

    env.call_private(user, recovery_contract.start_vote(candidate_address));
}

#[test(should_fail)]
unconstrained fn start_vote_already_started_failure() {
    let (env, contract_address, owner, user, _) = utils::setup_contract();
    let recovery_contract = Recovery::at(contract_address);

    let candidate = Field::from(0x000000000000000000000000000000000000dead);
    let candidate_address = EthAddress::from_field(candidate);

    env.call_private(owner, recovery_contract.add_contact(user));

    env.call_private(user, recovery_contract.start_vote(candidate_address));

    env.mine_block();

    env.call_private(user, recovery_contract.start_vote(candidate_address));
}

#[test]
unconstrained fn vote_success() {
    let (env, contract_address, owner, user, _) = utils::setup_contract();
    let recovery_contract = Recovery::at(contract_address);

    let candidate = Field::from(0x000000000000000000000000000000000000dead);
    let candidate_address = EthAddress::from_field(candidate);

    env.call_private(owner, recovery_contract.add_contact(user));

    env.mine_block();
    let is_in_contacts = env.call_private(user, recovery_contract.is_address_in_contacts(user));
    assert(is_in_contacts, "User should be in contacts");

    env.call_private(user, recovery_contract.start_vote(candidate_address));

    env.mine_block();
    env.call_private(user, recovery_contract.vote(candidate_address));

    let votes = env.call_private(user, recovery_contract.get_votes_by_candidate(candidate_address));
    assert(votes == 1, "Votes should be 1");
}

#[test(should_fail_with = "Failed to get a note")]
unconstrained fn vote_already_voted_failure() {
    let (env, contract_address, owner, user, _) = utils::setup_contract();
    let recovery_contract = Recovery::at(contract_address);

    let candidate = Field::from(0x000000000000000000000000000000000000dead);
    let candidate_address = EthAddress::from_field(candidate);

    env.call_private(owner, recovery_contract.add_contact(user));

    env.mine_block();
    let is_in_contacts = env.call_private(user, recovery_contract.is_address_in_contacts(user));
    assert(is_in_contacts, "User should be in contacts");

    env.call_private(user, recovery_contract.start_vote(candidate_address));

    env.mine_block();
    env.call_private(user, recovery_contract.vote(candidate_address));

    let votes = env.call_private(user, recovery_contract.get_votes_by_candidate(candidate_address));
    assert(votes == 1, "Votes should be 1");

    env.mine_block();
    env.call_private(user, recovery_contract.vote(candidate_address));
}
