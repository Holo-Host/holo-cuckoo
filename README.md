## Holo cuckoo

Quick sctipt for checking ability to connect over Web Sockets to other nodes on the same ZeroTier network.

Because Holo cuckoo executes ```zerotier-cli``` binary it has to be called with the same permission that ```zerotier-cli``` requires.

## How to

### Install

```
git clone https://github.com/Holo-Host/holo_cuckoo.git
cd holo_cuckoo
yarn install
```

### Configure

Make sure to update ```networkId``` and ```accessToken``` consts in the file to match your ZeroTier settings.

### Run

Run `node holo_cuckoo.js`
