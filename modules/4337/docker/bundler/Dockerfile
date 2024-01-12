FROM docker.io/library/node:18

RUN git clone https://github.com/eth-infinitism/bundler /src/bundler
WORKDIR /src/bundler
RUN git checkout v0.6.1

RUN yarn && yarn preprocess
ENTRYPOINT ["yarn", "bundler"]
CMD []
