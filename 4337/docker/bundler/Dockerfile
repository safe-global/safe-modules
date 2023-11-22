FROM docker.io/library/node:18

RUN git clone https://github.com/eth-infinitism/bundler /src/bundler
WORKDIR /src/bundler
# v0.6.1
RUN git checkout 30dc20da10214415df60a5ee15a6bec0975c9af1

RUN yarn && yarn preprocess
ENTRYPOINT ["yarn", "bundler"]
CMD []
