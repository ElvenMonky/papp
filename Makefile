#http://www.gnu.org/prep/standards/html_node/Standard-Targets.html#Standard-Targets

SHELL := /bin/bash
all: build

pkgconfig:
	@if [[ `which pkg-config` ]]; then echo "Success: Found pkg-config"; else "echo you need pkg-config installed" && exit 1; fi;

./node_modules/node-pre-gyp:
	npm install node-pre-gyp

./node_modules: ./node_modules/node-pre-gyp
	source ./bootstrap.sh && npm install `node -e "console.log(Object.keys(require('./package.json').dependencies).join(' '))"` \
	`node -e "console.log(Object.keys(require('./package.json').devDependencies).join(' '))"` --clang=1

./build: pkgconfig ./node_modules
	source ./bootstrap.sh && ./node_modules/.bin/node-pre-gyp configure build --loglevel=error --clang=1

debug: pkgconfig ./node_modules
	export TARGET=Debug && source ./bootstrap.sh && ./node_modules/.bin/node-pre-gyp configure build --debug --clang=1

coverage: pkgconfig ./node_modules
	source ./bootstrap.sh && ./node_modules/.bin/node-pre-gyp configure build --debug --clang=1 --coverage=true

verbose: pkgconfig ./node_modules
	source ./bootstrap.sh && ./node_modules/.bin/node-pre-gyp configure build --loglevel=verbose --clang=1

clean:
	@rm -rf ./build
	rm -rf ./lib/binding/
	rm -rf ./node_modules/
	rm -f ./*tgz
	rm -rf ./map
	rm -f ./*.osrm*
	rm -rf ./mason_packages
	rm -rf ./osrm-backend-*

grind:
	valgrind --leak-check=full node node_modules/.bin/_mocha

testpack:
	rm -f ./*tgz
	npm pack
	tar -ztvf *tgz
	rm -f ./*tgz

rebuild:
	@make clean
	@make

download:
	mkdir ./map
	wget http://download.geofabrik.de/europe-150731.osm.pbf -O ./map/map.osm.pbf

extract: ./map/map.osm.pbf
	./lib/binding/osrm-extract ./map/map.osm.pbf -p test/data/car.lua

prepare: ./map/map.osrm
	./lib/binding/osrm-prepare ./map/map.osrm -p test/data/car.lua

store: ./map/map.osrm
	./lib/binding/osrm-datastore ./map/map.osrm

test: ./map/map.osrm.hsgr
	./node_modules/.bin/mocha -R spec

install:
	sed -i -e "s@<petrolapp-directory>@${PWD}@g" ./node-osrm-petrolapp.conf
	sudo cp node-osrm-petrolapp.conf /etc/init

.PHONY: test clean build