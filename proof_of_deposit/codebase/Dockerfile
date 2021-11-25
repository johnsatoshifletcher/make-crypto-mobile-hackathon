FROM node:16.13.0

# install truffle for deploying contracts
RUN npm install -g truffle@5.4.0

# copy stuff over
RUN mkdir /code
COPY contracts /code/contracts
COPY webapp /code/webapp

# install modules
RUN cd /code/contracts && npm install
RUN cd /code/webapp && npm install

# deploy contracts and copy abis over to webapp
RUN cd /code/contracts && truffle migrate --network alfajores --reset && \
    cp build/contracts/Election.json ../webapp/utils/abis/ && \
    cp build/contracts/LockedCGLD.json ../webapp/utils/abis/ && \
    cp build/contracts/LockedCUSD.json ../webapp/utils/abis/ && \
    cp build/contracts/LockedCEUR.json ../webapp/utils/abis/

WORKDIR /code/webapp
ENTRYPOINT yarn run dev