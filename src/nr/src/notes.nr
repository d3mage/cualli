use dep::aztec::{
    macros::notes::note,
    oracle::random::random,
    protocol_types::{address::AztecAddress, traits::{Deserialize, Serialize}},
};

#[note]
#[derive(Eq, Serialize, Deserialize)]
pub struct AddressNote {
    address: AztecAddress,
    owner: AztecAddress,
    randomness: Field,
}

impl AddressNote {
    pub fn new(address: AztecAddress, owner: AztecAddress) -> Self {
        //Safety: required for randomness
        let randomness = unsafe { random() };
        AddressNote { address, owner, randomness }
    }
}

#[note]
#[derive(Eq, Serialize, Deserialize)]
pub struct VoteNote {
    votes: Field,
    finished: bool,
    owner: AztecAddress,
    randomness: Field,
}

impl VoteNote {
    pub fn new(votes: Field, finished: bool, owner: AztecAddress) -> Self {
        //Safety: required for randomness
        let randomness = unsafe { random() };
        VoteNote { votes, finished, owner, randomness }
    }
}
