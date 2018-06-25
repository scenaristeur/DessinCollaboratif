(function(canvas, socket, sizeToolbar, colorToolbar, counter) {
    var ctx = canvas.getContext('2d');

    var oldPos = {};

    var size = 4;
    var color = '#222';

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // populate the toolbars
    for (var i=1; i<10; i++) {
        var lineSize = Math.round(i*2);
        var el = document.createElement('button');
        el.innerHTML = lineSize;
        el.dataset.size = lineSize;
        el.addEventListener('click', function() {
            size = this.dataset.size;
        });
        sizeToolbar.appendChild(el);
    }

    var colors = [];
    for (var i=0; i<10; i++) {
        colors.push('hsl('+(36*i-6)+', 93%, 47%)');
    }
    colors.push('#eee', '#222');
    for (var i=0; i<colors.length; i++) {
        var el = document.createElement('button');
        el.dataset.color = colors[i];
        el.style.background = colors[i];
        el.addEventListener('click', function() {
            color = this.dataset.color;
        });
        colorToolbar.appendChild(el);
    }

    function eventToXY(e) {
        return {
            x: e.offsetX || e.layerX || e.clientX - canvas.offsetLeft,
            y: e.offsetY || e.layerY || e.clientY - canvas.offsetTop
        };
    }

    function line(start, end, size, color) {
        var oldSize = ctx.lineWidth;
        var oldColor = ctx.fillStyle;

        ctx.lineWidth = size;
        ctx.strokeStyle = color;

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.closePath();

        ctx.lineWidth = oldSize;
        ctx.strokeStyle = oldColor;
    }

    function handleStart(e) {
        oldPos = eventToXY(e);
        handleMove(e); // draw a single point
    }

    function handleMove(e) {
        var newPos = eventToXY(e);
        var data = {start: oldPos, end: newPos, size: size, color: color};
        socket.emit('line', data);
        line(oldPos, newPos, size, color);
        oldPos = newPos;
    };

    function handleEnd(e) {
        oldPos = {};
    }

    canvas.addEventListener('mousedown', function(e) {
        if (e.which == 1) {
            handleStart(e);
        }
    });

    canvas.addEventListener('mousemove', function(e) {
      e.preventDefault();
        if (e.buttons & 1) {
            handleMove(e);
        }
    });

    canvas.addEventListener('mouseout', handleEnd);

    canvas.addEventListener('touchstart', function(e) {
        var touches = e.touches;
        if (touches.length == 1) {
            handleStart(touches[0]);
        }
    });

    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
        var touches = e.touches;
        if (touches.length == 1) {
          //  console.log(eventToXY(touches[0]));
            handleMove(touches[0]);
        }
    });

    canvas.addEventListener('touchend', handleEnd);

    // remote events
    socket.on('line', function(data) {
        line(data.start, data.end, data.size, data.color);
    });

    socket.on('num_clients', function(data) {
        counter.innerHTML = data;
    });

    // download
    const download = document.getElementById('download');
    const rand = i=>Math.random()*i<<0;
    const fileName = `image${100+rand(100)}.png`;

        function onClickAnchor(e) {
          canvas.style.backgroundColor = 'rgba(158, 167, 184)';
      if (window.navigator.msSaveBlob) {
        window.navigator.msSaveBlob(canvas.msToBlob(), fileName);
        e.preventDefault();
      } else {
        download.setAttribute('download', fileName);
        download.setAttribute('href', canvas.toDataURL());
      }
    }

    download.addEventListener('click', onClickAnchor);

})(document.getElementById('scratchpad'), io(), document.getElementById('size-toolbar'), document.getElementById('color-toolbar'), document.getElementById('counter'));
