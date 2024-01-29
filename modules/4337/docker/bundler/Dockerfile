FROM docker.io/library/node:18

ARG TAG=v0.6.1
RUN git clone https://github.com/eth-infinitism/bundler /src/bundler
WORKDIR /src/bundler
RUN git checkout ${TAG}

RUN sed -i 's|0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789|0x506D9aB079BEBB8A25EA07f75e794c0b15f354C2|g' packages/bundler/localconfig/bundler.config.json
RUN yarn && yarn preprocess
ENTRYPOINT ["yarn", "bundler"]
CMD []
