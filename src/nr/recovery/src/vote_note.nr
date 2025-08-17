use dep::aztec::{
    macros::notes::note,
    oracle::random::random,
    protocol_types::{address::AztecAddress, traits::{Deserialize, Serialize}},
};

#[note]
#[derive(Eq, Serialize, Deserialize)]
pub struct VoteNote {
    candidate: AztecAddress,
    voter: AztecAddress,
    owner: AztecAddress,
    randomness: Field,
}

impl VoteNote {
    pub fn new(candidate: AztecAddress, voter: AztecAddress, owner: AztecAddress) -> Self {
        let randomness = unsafe { random() };
        VoteNote { candidate, voter, owner, randomness }
    }
}
