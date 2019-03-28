const { exec } = require('child_process')
const request = require('request')
const WebSocket = require('ws')

/* global consts and lets */
const networkId = '12ac4a1e71bb15cf' // ZeroTier network identifier
const accessToken = '' // Access token to ZeroTier Central API
const wsServerPort = 4141 // Port for WebSocket communication between nodes
const retryTimeout = 5000 // 5 sec
let me = {} // Object holding info about me

/* Check the status of zero-tier connection */
exec('zerotier-cli info -j', (err, stdout, stderr) => {
    if (err) {
        console.log(`Can't execute zerotier-cli: ${stderr}`)
        return;
    }

    try {
        me = { address } = JSON.parse(stdout)
    } catch (e) {
        console.log(`Can't parse my addressId: ${e}`)
    }

    // Step 1 - Print status of the network
    listNetworks()
})

/* Check status of connection to the network */
const listNetworks = () => exec('zerotier-cli listnetworks -j', (err, stdout, stderr) => {
    console.log('\nVirtual network connection status:');
    if (err) {
        console.log(`Can't execute zerotier-cli: ${stderr}`)
        return;
    }

    try {
        const networks = JSON.parse(stdout);
        console.log('networkName'.padEnd(24), 'networkId'.padEnd(20), 'connecitonStatus'.padEnd(20), 'IPv4')
        for (network of networks) {
            // Only list requested network
            if (network.id !== networkId) continue;

            // Extract IPv4 from network.assignedAddresses
            let address = ""
            for (address of network.assignedAddresses) {
                if (/(\d+(\.|\/)){4}\d+/.test(address)) ipv4 = address
            }
            console.log(network.name.padEnd(24), network.id.padEnd(20), network.status.padEnd(20), ipv4)
        }
    } catch (e) {
        console.log(`Can't parse list of networks: ${e}`)
    }

    // Step 2 - list all the nodes on networks
    listNodes()
});

/* List all the nodes connected to the network */
const listNodes = () => {
    console.log('\nNodes particitpating in virtual network:');

    const options = {
        url: `https://my.zerotier.com/api/network/${networkId}/member`,
        headers: {
            Authorization: `bearer ${accessToken}`
        }
    };
    
    const callback = (error, res, body) => {
        let addresses = [];
        try {     
            if (!error && res.statusCode == 200) {
                const nodes = JSON.parse(body);

                console.log('physicalAddress'.padEnd(16), 'virtualAddress'.padEnd(16), 'name'.padEnd(12), 'online'.padEnd(12))
                for (node of nodes) {
                    // Exclude Planets and without IPv4
                    if (!(node.type === 'Member' && node.config && node.config.ipAssignments && node.config.ipAssignments[0])) continue;
    
                    // Exclude myself 
                    if (node.nodeId === me.address)
                        me.ip = node.config.ipAssignments[0]
                    else
                        addresses.push(node.config.ipAssignments[0])
    
                    console.log(node.physicalAddress.toString().padEnd(16), node.config.ipAssignments[0].toString().padEnd(16), node.name.toString().padEnd(12), node.online.toString().padEnd(8), (node.nodeId === me.address)?`**It's ME**`:``)
                }
            } else {
                throw new Error("Can't connect to ZeroTier Central Server");
            }
    
            // Step 3 - start ws server
            startWsServer()
    
            // Step 4 - connect to other nodes
            connectToNodes(addresses)
        } catch (e) {
            console.log(e.message)
        } 
    }

    request(options, callback)
}


/* Start WebSocket server plus as a webSocket client open connection with every other node on the network */
const startWsServer = () => {
    console.log('\nStarting wss server on port ' + wsServerPort)

    const wsServer = new WebSocket.Server({ port: wsServerPort })
    wsServer.on('connection', (ws, req) => {
        // console.log((new Date()).toJSON().slice(0, 19).replace(/[-T]/g, ':') + ' Client opened connection')
        
        ws.on('message', message => {
            // console.log(`Received message form client => ${message}`)
        })
        
        // ws.send('Connected to wss server at ' + req.headers.host)
    })
}

/* Establish Web Socket connections with other nodes participating in virtual network */
const connectToNodes = async (addresses) => {
    console.log('Connecting to other nodes over Web Sockets')
    for (address of addresses) {
        console.log(`${address}: connecting ...`)
        await connectWs(address);
    }
}

/* Web Socket connection creaetor with all the params and event listeners */
const connectWs = async (address) => {
    try {
        const ws = new WebSocket(`ws://${address}:${wsServerPort}/`)

        ws.on('open', function open() {
            console.log(`${address}: connection OK`);
            //ws.send(address);
            const int = setInterval(() => {
                try {
                    ws.send('')
                } catch (e) {
                    console.log(`${address}: connection failed, retrying ...`)
                    clearInterval(int)
                    connectWs(address)
                }
            }, retryTimeout);
        });

        ws.on('close', function close() {
            // console.log(`${address}: connection closed`)
        });

        ws.on('message', function incoming(data) {
            // console.log(`Received: ${data}`);
        });

        ws.on('error', function err(data) {
            // console.log(`${address}: connection failed`)
            setTimeout(() => {connectWs(address)}, retryTimeout)
        });
    } catch (err) {
        console.log(`Failed to connect to ${address}: ${err}`)
    }
}