#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

printf "\n>>> Cleaning up staging area for CloudFormation...\n"
rm -rf build
mkdir build

# Enter /shared
pushd shared/shared-models
rm -rfv dist node_modules | sed 's/\([^/]*\)\/.*$/\1/' | sort | uniq
npm i
tsc
popd

pushd shared/shared-utils
rm -rfv dist node_modules | sed 's/\([^/]*\)\/.*$/\1/' | sort | uniq
npm i
tsc
popd

# Enter /server
pushd server

printf "\n>>> Cleaning up staging area for server...\n"
rm -rfv dist node_modules | sed 's/\([^/]*\)\/.*$/\1/' | sort | uniq

printf "\n>>> Building...\n"
npm i
tsc
