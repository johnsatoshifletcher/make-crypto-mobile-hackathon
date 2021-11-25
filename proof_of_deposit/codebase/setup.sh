#!/bin/bash -e

echo "Installing Contract modules"
cd contracts
npm install

echo "Installing WebApp modules"
cd webapp
npm install

echo "Deploying contracts"
cd contracts
truffle migrate --network alfajores --reset

echo "Copying ABIs to WebApp"
cd ../webapp
cp ../contracts/build/contracts/Election.json utils/abis/ 
cp ../contracts/build/contracts/LockedCGLD.json utils/abis/
cp ../contracts/build/contracts/LockedCUSD.json utils/abis/
cp ../contracts/build/contracts/LockedCEUR.json utils/abis/

echo "Starting WebApp"
yarn run dev