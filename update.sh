#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Enter /shared/shared-models
pushd shared/shared-models
printf "\n>>> Update dependencies for shared-models...\n"
rm -rfv dist node_modules | sed 's/\([^/]*\)\/.*$/\1/' | sort | uniq
npm i
tsc
popd

# Enter /shared/shared-utils
pushd shared/shared-utils
printf "\n>>> Update dependencies for shared-utils...\n"
rm -rfv dist node_modules | sed 's/\([^/]*\)\/.*$/\1/' | sort | uniq
npm i
tsc
popd

# Enter /server
pushd server

printf "\n>>> Update dependencies for server...\n"
rm -rfv dist node_modules | sed 's/\([^/]*\)\/.*$/\1/' | sort | uniq

printf "\n>>> Building...\n"
npm i
tsc

popd

# Enter /frontend
pushd frontend

printf "\n>>> Update dependencies for front-end...\n"
rm -rfv node_modules/shared-models | sed 's/\([^/]*\)\/.*$/\1/' | sort | uniq

printf "\n>>> Building...\n"
npm i

popd
