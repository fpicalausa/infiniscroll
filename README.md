InfiniScroll
============

InfiniScroll is a jQuery plugin that allows scrolling a 2D board of tiles
indefinitely in any direction. Tiles are pre-loaded as they are needed.
Touch events are supported.

Usage is as simple as defining a target element on the HTML side:

    <div style="position:absolute; top:0; left:0; bottom:0; right:0;" id="scrollable"></div>

And adding some JavaScript to load tiles:

    $("#scrollable").infiniScroll({
        tileWidth: 200, //px
        tileHeight: 200, //px
        loader: function(tile, x, y) {
            $(tile).text("x=" + x + ", y=" + y);
        }
    });

