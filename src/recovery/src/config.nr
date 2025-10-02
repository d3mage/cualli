use aztec::protocol_types::{
    address::{AztecAddress},
    traits::{Deserialize, Packable, Serialize},
};
use std::meta::derive;

#[derive(Deserialize, Eq, Packable, Serialize)]
pub struct Config {
    pub owner: AztecAddress,
    pub wormhole_address: AztecAddress,
}
