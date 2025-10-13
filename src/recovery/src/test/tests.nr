use crate::{Recovery, test::utils};

use aztec::protocol_types::{address::{AztecAddress, EthAddress}, traits::FromField};

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


#[test]
unconstrained fn send_wormhole_message_success() {
    let (env, contract_address, owner, user, _) = utils::setup_contract();
    let recovery_contract = Recovery::at(contract_address);

    let candidate = Field::from(0x1234567890abcdef1234567890abcdef12345678);
    let candidate_address = EthAddress::from_field(candidate);

    // Create wormhole message payload (7 arrays of 31 bytes)
    // msg[0] = destination address (EVM address)
    // msg[1] = destination chain id
    // msg[2-6] = additional message data (unused in this test)
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
    
    let msg: [[u8; 31]; 7] = [
        dest_addr,
        chain_id,
        zero_bytes,
        zero_bytes,
        zero_bytes,
        zero_bytes,
        zero_bytes,
    ];

    env.call_public(owner, recovery_contract.send_wormhole_message(
        candidate_address,
        msg,
    ));
}