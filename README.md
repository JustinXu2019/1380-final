# distribution

This is the distribution library.

## Environment Setup

We recommend using the prepared [container image](https://github.com/brown-cs1380/container).

## Installation

After you have setup your environment, you can start using the distribution library.
When loaded, distribution introduces functionality supporting the distributed execution of programs. To download it:

```sh
$ npm i '@brown-ds/distribution'
```

This command downloads and installs the distribution library.

## Testing

There are several categories of tests:

- Regular Tests (`*.test.js`)
- Scenario Tests (`*.scenario.js`)
- Extra Credit Tests (`*.extra.test.js`)
- Student Tests (`*.student.test.js`) - inside `test/test-student`

### Running Tests

By default, all regular tests are run. Use the options below to run different sets of tests:

1. Run all regular tests (default): `$ npm test` or `$ npm test -- -t`
2. Run scenario tests: `$ npm test -- -c`
3. Run extra credit tests: `$ npm test -- -ec`
4. Run the `non-distribution` tests: `$ npm test -- -nd`
5. Combine options: `$ npm test -- -c -ec -nd -t`

## Usage

To try out the distribution library inside an interactive Node.js session, run:

```sh
$ node
```

Then, load the distribution library:

```js
> let distribution = require("@brown-ds/distribution")();
> distribution.node.start(console.log);
```

Now you have access to the full distribution library. You can start off by serializing some values.

```js
> s = distribution.util.serialize(1); // '{"type":"number","value":"1"}'
> n = distribution.util.deserialize(s); // 1
```

You can inspect information about the current node (for example its `sid`) by running:

```js
> distribution.local.status.get('sid', console.log); // null 8cf1b (null here is the error value; meaning there is no error)
```

You can also store and retrieve values from the local memory:

```js
> distribution.local.mem.put({name: 'nikos'}, 'key', console.log); // null {name: 'nikos'} (again, null is the error value)
> distribution.local.mem.get('key', console.log); // null {name: 'nikos'}

> distribution.local.mem.get('wrong-key', console.log); // Error('Key not found') undefined
```

You can also spawn a new node:

```js
> node = { ip: '127.0.0.1', port: 8080 };
> distribution.local.status.spawn(node, console.log);
```

Using the `distribution.all` set of services will allow you to act
on the full set of nodes created as if they were a single one.

```js
> distribution.all.status.get('sid', console.log); // {} { '8cf1b': '8cf1b', '8cf1c': '8cf1c' } (now, errors are per-node and form an object)
```

You can also send messages to other nodes:

```js
> distribution.local.comm.send(['sid'], {node: node, service: 'status', method: 'get'}, console.log); // null 8cf1c
```

Most methods in the distribution library are asynchronous and take a callback as their last argument.
This callback is invoked when the method completes, with the first argument being an error (if any) and the second argument being the result.
The following runs the sequence of commands described above inside a script (note the nested callbacks):

```js
let distribution = require("@brown-ds/distribution")();
// Now we're only doing a few of the things we did above
const out = (cb) => {
  distribution.local.status.stop(cb); // Shut down the local node
};
distribution.node.start(() => {
  // This will run only after the node has started
  const node = { ip: "127.0.0.1", port: 8765 };
  distribution.local.status.spawn(node, (e, v) => {
    if (e) {
      return out(console.log);
    }
    // This will run only after the new node has been spawned
    distribution.all.status.get("sid", (e, v) => {
      // This will run only after we communicated with all nodes and got their sids
      console.log(v); // { '8cf1b': '8cf1b', '8cf1c': '8cf1c' }
      // Shut down the remote node
      distribution.local.comm.send(
        [],
        { service: "status", method: "stop", node: node },
        () => {
          // Finally, stop the local node
          out(console.log); // null, {ip: '127.0.0.1', port: 1380}
        },
      );
    });
  });
});
```
# Running Performance Tests on AWS

## Prerequisites

- EC2 instances with port `7110` open in the security group inbound rules
- Code cloned on all nodes (branch code):

```bash
  git clone -b nlp-optimizations https://github.com/JustinXu2019/1380-final.git
  cd 1380-final
  npm install
```

## Worker Nodes (all nodes except orchestrator)

Get the private IP:

```bash
hostname -I | awk '{print $1}'
```

Start the node listener:

```bash
node distribution.js --ip <private-ip> --port 7110
```

Keep this process running. Do this on every worker node before starting the orchestrator.

## Orchestrator Node

Get the private IP:

```bash
hostname -I | awk '{print $1}'
```

In `test/search.performance.test.js`, update two things:

1. Add all worker node private IPs to the `nodes` array:

```js
   const nodes = [
     {ip: '<worker-1-private-ip>', port: 7110},
     {ip: '<worker-2-private-ip>', port: 7110},
     // add more as needed
   ];
```

2. Set the orchestrator's own private IP in `beforeAll`:

```js
   distribution.node.config = {ip: '<orchestrator-private-ip>', port: 7110};
```

Run the test:

```bash
npx jest test/search.performance.test.js
```

## Crawl Size

In `test/search.performance.test.js`, the `maxPages` variable controls how many pages to crawl:

```js
const maxPages = 100;
```

## Notes

- Always use private IPs, not public IPs
- All worker nodes must be running before starting the orchestrator
- If a worker crashes mid-test (`ECONNRESET`), restart it and rerun the test

# Results and Reflections

> ...

# M1: Serialization / Deserialization

## Summary

> My implementation of serialization and deserialization was built on top of the existing JSON.stringify() and JSON.parse() methods. It was 2 components totaling about 51 lines of code in total. In both functions, I utilized the second parameter which was the replacer and reviver function respectively. The replacer function in serialize was used to check for all the edge cases which the method did not account for or would error for and would in return stringify my own custom object. Then in the reviver function it would parse through the string and check for my custom objects to handle the cases which the JSON.parse() method does not inherently check for. The biggest challenge for me was serializing Date() objects in a way which I could later deserialize them. This is because if an object has a .toJSON method instead of being passed to the replacer function, .toJSON is immediately called so the object becomes a string without allowing me to turn it into my own object. To fix this problem I had to convert the replacer function from an arrow function to a regular function in order to use the this keyword.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

_Correctness_: For correctness I wrote 5 tests which test for negative numbers, special characters such as new lines "\n", test for empty objects/strings, special keys, and arrays that have gaps in them.

_Performance_: To test performance, I wrote 4 tests in order to test for basic, functions, and complext types of various sizes. I then run serialize and deserialize tests 1000 times in order to get the average latency. With the time from the latency I am also able to calculate the throughput.

# M2: Actors and Remote Procedure Calls (RPC)

## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M2 (`hours`) and the lines of code per task.

My implementation comprises 6 software components, totaling 496 lines of code and about 12 hours of work. I started with status.get() which was created with conditionals to pick the correct output. My implementation of route consisted of adding, removing, and selecting from the distribution.local object which contains all the imports/services. My implementation of comm consists of creating a http PUT request and handles the output within the callback function that receives a response. Finally my node implementation consists of constructing the sent data and all the parsing/response creation is done in the req.on('end') portion. The most challenging portions of this assignment for me was comm and node. Comm was challenging because I didn't realize that the output should be handled by the callback function in http.request(). It was also difficult to include error handling because I had to figure out where to place the errors. Node was challenging because while I could recieve the http request I did not know how to construct a response and it took me a while to figure out how to use route.js to call the requested service method. Finally, implementing the tests were extremely difficult because I did not account for erronious inputs and had to add that to my implementation of status, routes, and comm.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

_Correctness_: I wrote 12 tests; these tests take 5 seconds to execute. I mostly tested for erronious inputs for all of the functions I had to implement. This meant creating a default base case. The last 2 tests are for testing the throuhgput and latency of my implementation of comm and the library's implementation of rpc.

_Performance_: I characterized the performance of comm and RPC by sending 1000 service requests in a tight loop. Average throughput and latency is recorded in `package.json`.

## Key Feature

> How would you explain the implementation of `createRPC` to someone who has no background in computer science — i.e., with the minimum jargon possible?

The createRPC implementation is like a vending machine. You push a button to get something and that button tells the vending machine what you want to get, the vending machine then moves to the thing you want, and finally it gives you the thing you ordered.

# M3: Node Groups & Gossip Protocols

## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M3 (`hours`) and the lines of code per task.

My implementation comprises `<number>` new software components, totaling `<number>` added lines of code over the previous implementation. Key challenges included `<1, 2, 3 + how you solved them>`.

My implementation consisted of the distributed comm, group, routes, and status. I also implemented the local groups and modified comm, routes, and node. It took around 244 lines of code and around 10 hours to complete. A challenge which I encountered was trying to understand how each node has their own "view" of the system. This was solved when I realize that the way the implementation of our system works is by giving each group their own individual functions to each node can just have their own local view by having some sort of data structure to help keep track.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

_Correctness_ -- number of tests and time they take. I wrote 5 tests and they take around 1 second to exectue.

_Performance_ -- spawn times (all students) and gossip (lab/ec-only).
Per-node spawn latency~150–400 msAverage latency (6 nodes)~250 ms/nodeTotal elapsed (6 nodes sequential)~1 500 msThroughput (sequential)~4 nodes/sec

## Key Feature

> What is the point of having a gossip protocol? Why doesn't a node just send the message to _all_ other nodes in its group?

The point of having a gossip protocol is scalability. If a node has to send a message to _all_ other nodes it would be a O(n) operation where n is the number of nodes. But with the gossip protocol allows you to send much less messages to achieve the same result. Also if you broadcast to all nodes but one node happens to be down it can just get the message from another node when it comes back on the next gossip.

# M4: Distributed Storage

## Summary

> Summarize your implementation, including key challenges you encountered

Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M4 (`hours`) and the lines of code per task.

My implementation of M4 consisted of implementing get, put, and del for both the distributed and local mem and store. I also implemented the two hashing functions. This assignment took me around 15 hours and 463 lines of code. A key challenge which I faced was trying to understand the difference between the distributed function's view and the view of the local functions. It was somewhat confusing to wrap my head around calling the local functions and specifying the GIDs to implement the distributed functions. However, the local functions were very straightforward.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

_Correctness_ -- number of tests and time they take.
I characterized the correctness of my code by writing 5 tests which all test for erronious inputs for get and delete. This is because I did not implement the extra credit so I decided to throw an error if these functions were invoked without a key parameter. The tests take around 1 second to complete.

_Performance_ -- insertion and retrieval.
My performance is characterized by a script I write called perf.js. It pregenerates 1000 items and calls store.put to the 3 aws nodes. Then it calls get and logs the time it takes. The total time for all the puts to complete was around 38422ms and the mean latency was 38.42 ms. The throuhgput was about 26.03 operations a second. Retrieving took around 37914.91ms and the mean latency was 37.91ms with a throuhgput of 26.37.

## Key Feature

> Why is the `reconf` method designed to first identify all the keys to be relocated and then relocate individual objects instead of fetching all the objects immediately and then pushing them to their corresponding locations?
> I believe that the reconf method desinged to first identify all the keys to be relocated and then relocate individual objects is due to memory efficiency. If you fetch all objects first you're loading all the data into memory. By relocating individual objects you only ever hold one object at a time in memory.

# M5: Distributed Execution Engine

## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M5 (`hours`) and the lines of code per task.

My implementation of map reduce consists of filling out the functions provided in the mr.js file and also implementing mem.append both local and distributed versions. One of the challeneges I faced was trying to debug my implementation using utils.log because I could not console.log outputs to see what was being produced. I also did not relize that the test assumes that when you input a null key that it would return all the keys. I had to change my implementation of distributed mem.get in order to match this expectation. This assignment took me around 15 hours. It also took around 200 lies of code.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

_Correctness_: I wrote different scenarios to test.

_Performance_: I wrote a script which generates its own data and computes the min, max, mean to benchmark the time it takes for map reduce to execute. The mean time is around 121.3 ms.

## Key Feature

> Which extra features did you implement and how?

N/A

# M6:

## Summarize the process of writing the paper and preparing the poster, including any surprises you encountered.

Preparing the poster was straight-forward, writing concise summaries of our work and results. We wanted to focus on having a poster that could be easily read and interpreted, with simple graphs to show our performance. Some challenges we encountered were finding a good balance of text and visuals, and keeping the poster up-to-date with our latest optimizations and data, which made us sometimes have to revise multiple sections of the poster.

## Roughly, how many hours did M6 take you to complete?

Hours: <40>

## How many LoC did the distributed version of the project end up taking?

DLoC: <2982>

## How does this number compare with your non-distributed version?

LoC: <4500>
The original estimate was greater than the LoC of the distributed version, but the estimate for the LoC for the backend was only 1500, predicting that the majority of the LoC would come from the front-end, which was not completed.

## How different are these numbers for different members in the team and why?

Another member predicted 3000, which was extremely close to the total LoC and assumed the project to be fully backend. Across the team the estimates were never far off, but one member had the unique assumption of completing a front-end interface to display features.
