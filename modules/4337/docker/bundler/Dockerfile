FROM docker.io/library/node:18

ARG TAG=v0.6.1
RUN git clone https://github.com/eth-infinitism/bundler /src/bundler
WORKDIR /src/bundler
RUN git checkout ${TAG}

RUN yarn && yarn preprocess
ENTRYPOINT ["yarn", "bundler"]
CMD []
