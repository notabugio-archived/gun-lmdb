# gun-lmdb

LMDB adapter for gunDB based on node-lmdb

## Installation

    npm install @notabug/gun-lmdb

## Usage

    require("@notabug/gun-lmdb").attachToGun(Gun, {
      path: "path/to/an/existing/folder,
      mapSize: 1024**4 // Maximum size of database in bytes
    });
