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
        let randomness = unsafe { random() };
        AddressNote { address, owner, randomness }
    }
}
