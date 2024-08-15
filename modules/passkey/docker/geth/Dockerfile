FROM docker.io/library/golang:1.22 AS builder

# The Geth fork that was easiest to get running with the RIP-7212
# precompile was the Optimism Geth node. Note that we still need to apply a
# small patch, as the precompile is only enabled with Optimism consensus which
# is not enabled in Dev mode.
RUN git clone --depth 1 --branch v1.101315.3 https://github.com/ethereum-optimism/op-geth /src

WORKDIR /src
COPY docker/geth/geth.patch .
RUN git apply geth.patch && make geth

FROM docker.io/library/debian:bookworm-slim

COPY --from=builder /src/build/bin/geth /usr/local/bin/geth

ENTRYPOINT ["geth"]
CMD []
