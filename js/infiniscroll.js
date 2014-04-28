/*
Copyright (c) 2014 Francois Picalausa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

(function ($, document) {
    "use strict";

    function InfiniScroll(options, target) {
        var self = this;

        function checkOptions() {
            ["tileWidth", "tileHeight", "initialX", "initialY"].forEach(function (field) {
                if (typeof self.options[field] !== "number") {
                    throw new Error("Expected numeric value for " + field + " option");
                }
            });

            if (self.options.tileWidth <= 0) {
                throw new Error("Value for tileWidth option must be a strictly positive integer");
            }

            if (self.options.tileHeight <= 0) {
                throw new Error("Value for tileHeight option must be a strictly positive integer");
            }

            if (typeof self.options.loader !== "function") {
                throw new Error("Value for loader option must be a function");
            }
        }

        function nextOddNumber(value) {
            value = Math.ceil(value);
            if (value % 2 === 0) {
                return value + 1;
            }
            return value;
        }

        function calculateParameters() {
            self.parameters = {};

            self.parameters.viewportWidth = self.$target.width();
            self.parameters.viewportHeight = self.$target.height();

            self.parameters.visibleTilesX = nextOddNumber(self.parameters.viewportWidth / self.options.tileWidth);
            self.parameters.visibleTilesY = nextOddNumber(self.parameters.viewportHeight / self.options.tileHeight);

            self.parameters.loadMarginX = self.parameters.visibleTilesX + 1;
            self.parameters.loadMarginY = self.parameters.visibleTilesY + 1;
            self.parameters.loadedTilesX = self.parameters.loadMarginX * 2 + self.parameters.visibleTilesX;
            self.parameters.loadedTilesY = self.parameters.loadMarginY * 2 + self.parameters.visibleTilesY;

            self.parameters.containerWidth  = self.parameters.loadedTilesX * self.options.tileWidth;
            self.parameters.containerHeight = self.parameters.loadedTilesY * self.options.tileHeight;
            self.parameters.containerLeft   = (self.parameters.viewportWidth - self.options.tileWidth) / 2 - self.options.tileWidth * self.options.initialX;
            self.parameters.containerTop   = (self.parameters.viewportHeight - self.options.tileHeight) / 2 - self.options.tileHeight * self.options.initialY;

            self.parameters.offsetX = 0;
            self.parameters.offsetY = 0;

            self.parameters.focusTileX = self.options.initialX;
            self.parameters.focusTileY = self.options.initialY;

            self.parameters.minTileX = self.parameters.focusTileX - (self.parameters.loadedTilesX - 1) / 2;
            self.parameters.minTileY = self.parameters.focusTileY - (self.parameters.loadedTilesY - 1) / 2;
            self.parameters.maxTileX = self.parameters.focusTileX + (self.parameters.loadedTilesX - 1) / 2;
            self.parameters.maxTileY = self.parameters.focusTileY + (self.parameters.loadedTilesY - 1) / 2;
        }

        function setupTilesContainer() {
            self.$tilesContainer.css({
                position: 'relative',
                transform: 'translate(' + self.parameters.containerLeft + 'px,' + self.parameters.containerTop + 'px)',
                width: self.parameters.containerWidth,
                height: self.parameters.containerHeight,
                borderCollapse: 'collapse'
            });
        }

        function isInBounds(x, y, bounds) {
            return (bounds.minTileX <= x && x <= bounds.maxTileX) &&
                   (bounds.minTileY <= y && y <= bounds.maxTileY);
        }

        function isOnBoard(x, y) {
            return isInBounds(x, y, self.parameters);
        }

        function isTileOnBoard(tile) {
            return isOnBoard(tile.data("x"), tile.data("y"));
        }

        function bindTileToLocation(tile, x, y) {
            tile.data("x", x);
            tile.data("y", y);

            tile.css({
                top: Math.floor(self.options.tileHeight * y),
                left: Math.floor(self.options.tileWidth * x)
            });
        }

        function loadTile(loadable) {
            var tile = loadable.tile,
                x = loadable.x,
                y = loadable.y;

            bindTileToLocation(tile, x, y);
            tile.css({ "background": "none" });
            tile.data("loaded", true);
            self.options.loader(tile, x, y, loadQueuedTile);

            return tile;
        }

        function getLoadableTileFromQueue(queue) {
            var location = queue.shift();

            while (location) {
                if (isOnBoard(location.x, location.y)) {
                    return location;
                }

                location = queue.shift();
            }
        }

        function loadQueuedTile() {
            var loadable = getLoadableTileFromQueue(self.loadQueue);

            if (loadable) {
                self.$tilesContainer.append(
                    loadTile(loadable)
                );
            }
        }

        function createTile() {
            var tile = $('<div class="tile"></div>');
            tile.css({
                position: 'absolute',
                width: self.options.tileWidth,
                height: self.options.tileHeight,
                padding: 0,
                margin: 0,
                border: 0
            });
            tile.data("loaded", false);
            return tile;
        }

        function enqueueInitialLoaders() {
            var i, j;

            for (i = self.parameters.minTileY; i <= self.parameters.maxTileY; i++) {
                for (j = self.parameters.minTileX; j <= self.parameters.maxTileX; j++) {
                    self.loadQueue.push({
                        tile: createTile(),
                        x: j,
                        y: i
                    });
                }
            }
        }

        function recomputeParameters() {
            var deltaX = self.parameters.offsetX,
                deltaY = self.parameters.offsetY;
            self.parameters.offsetX = 0;
            self.parameters.offsetY = 0;
            self.parameters.containerLeft += deltaX;
            self.parameters.containerTop += deltaY;

            self.parameters.focusTileX = Math.floor((-self.parameters.containerLeft + self.parameters.viewportWidth / 2) / self.options.tileWidth);
            self.parameters.focusTileY = Math.floor((-self.parameters.containerTop + self.parameters.viewportHeight / 2) / self.options.tileHeight);

            self.parameters.minTileX = self.parameters.focusTileX - (self.parameters.loadedTilesX - 1) / 2;
            self.parameters.minTileY = self.parameters.focusTileY - (self.parameters.loadedTilesY - 1) / 2;
            self.parameters.maxTileX = self.parameters.focusTileX + (self.parameters.loadedTilesX - 1) / 2;
            self.parameters.maxTileY = self.parameters.focusTileY + (self.parameters.loadedTilesY - 1) / 2;
        }

        function removeOutOfBoundTilesFromLoadableList(list, unboundTiles) {
            var result = [];
            list.forEach(function (index, element) {
                if (!isOnBoard(element.x, element.y)) {
                    unboundTiles.push(element.tile);
                } else {
                    result.push(element);
                }
            });

            return result;
        }

        function loadNewTiles(unboundTiles, newBounds, oldBounds) {
            var i, j;
            for (i = newBounds.minTileY; i <= newBounds.maxTileY; ++i) {
                for (j = newBounds.minTileX; j <= newBounds.maxTileX; ++j) {
                    if (!isInBounds(j, i, oldBounds)) {
                        self.loadQueue.push({
                            tile: unboundTiles.pop(),
                            x: j,
                            y: i
                        });
                    }
                }
            }
        }

        function rebindTiles(oldBounds) {
            var unbound = [];
            // Find all out of bound tiles
            self.$tilesContainer.find(".tile").each(function (index, tile) {
                var $tile = $(tile);
                if ($tile.data("loaded") && !isTileOnBoard($tile)) {
                    unbound.push($tile);
                    $tile.css({ background: "red" });
                    $tile.data("loaded", false);
                }
            });

            // Find all out of bound tiles remaining in the load queue
            self.loadQueue = removeOutOfBoundTilesFromLoadableList(self.loadQueue, unbound);

            // Find all tiles to be loaded.
            loadNewTiles(unbound, self.parameters, oldBounds);

            loadQueuedTile();
        }

        function startDrag(pageX, pageY) {
            self.parameters.dragStartX = pageX;
            self.parameters.dragStartY = pageY;
        }

        function stopDrag() {
            var oldBounds = {
                minTileX: self.parameters.minTileX,
                maxTileX: self.parameters.maxTileX,
                minTileY: self.parameters.minTileY,
                maxTileY: self.parameters.maxTileY
            };

            recomputeParameters();
            rebindTiles(oldBounds);
        }

        function dragging(pageX, pageY) {
            self.parameters.offsetX = pageX - self.parameters.dragStartX;
            self.parameters.offsetY = pageY - self.parameters.dragStartY;

            var left = (self.parameters.containerLeft + self.parameters.offsetX),
                top  = (self.parameters.containerTop  + self.parameters.offsetY);

            self.$tilesContainer.css({
                transform: 'translate(' + left + 'px,' + top + 'px)'
            });
        }

        function mouseMoveHandler (e) {
            if (self.parameters.leftButtonDown) {
                dragging(e.pageX, e.pageY);
            }
            return false;
        }

        function touchMoveHandler (e) {
            dragging(e.originalEvent.changedTouches[0].pageX, e.originalEvent.changedTouches[0].pageY);
            return false;
        }

        function registerScrollHandlers() {
            self.$tilesContainer.on("mousedown", function (e) {
                startDrag(e.pageX, e.pageY);
                $(document).one("mouseup", stopDrag);
            });
            self.$tilesContainer.on("mousemove", null, null, mouseMoveHandler);

            self.$tilesContainer.on("touchstart", function (e) {
                startDrag(e.originalEvent.changedTouches[0].pageX, e.originalEvent.changedTouches[0].pageY);
            });
            $(document).on("touchmove", null, null, touchMoveHandler);
            $(document).on("touchend", null, null, stopDrag);
            self.$tilesContainer.on("touchmove", null, null, touchMoveHandler);
            self.$tilesContainer.on("touchend", null, null, stopDrag);
        }

        self.loadQueue = [];
        self.$target = $(target);
        self.$tilesContainer = $('<div class="infiniScroll container"></div>');
        self.options = $.extend({}, $.fn.infiniScroll.options, options);

        self.$target.css({
            userSelect: 'none'
        });
        checkOptions();
        calculateParameters();
        setupTilesContainer();

        enqueueInitialLoaders();
        registerScrollHandlers();

        loadQueuedTile();

        self.$target.append(self.$tilesContainer);

        self.parameters.leftButtonDown = false;
        $(document).mousedown(function(e){
            if(e.which === 1) {
                self.parameters.leftButtonDown = true;
            }
        });
        $(document).mouseup(function(e){
            // Left mouse button was released, clear flag
            if(e.which === 1) {
                self.parameters.leftButtonDown = false;
            }
        });
    }

    $.fn.infiniScroll = function (options) {
        return this.each(function () {
            if ($(this).data("infiniScroll-setup") === true) {
                return;
            }

            $(this).data("infiniScroll-setup", true);
            $(this).data("infiniScroll", new InfiniScroll(options, this));
            $(this).css({ "overflow": "hidden", "userSelect": 'none' });
        });
    };

    $.fn.infiniScroll.options = {
        tileWidth: 200,
        tileHeight: 200,
        initialX: 0,
        initialY: 0,
        loader: function (target, x, y, cb) {
            $(target).text("(" + x + "," + y + ")");
            $(target).css({
                userSelect: 'none',
                lineHeight: '200px',
                textAlign: 'center',
                border: '1px solid #bbb'
            });

            cb();
        }
    };
}(jQuery, document));
