(function () {
    var containers = document.querySelectorAll('.footer-hover-text');
    containers.forEach(function (container) {
        var text = container.getAttribute('data-text') || 'GENIUS';
        var svgNS = 'http://www.w3.org/2000/svg';

        var svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', '0 0 300 100');
        svg.setAttribute('xmlns', svgNS);

        var defs = document.createElementNS(svgNS, 'defs');

        // Linear gradient (appears on hover)
        var linearGrad = document.createElementNS(svgNS, 'linearGradient');
        linearGrad.setAttribute('id', 'footerTextGradient');
        linearGrad.setAttribute('gradientUnits', 'userSpaceOnUse');
        linearGrad.setAttribute('cx', '50%');
        linearGrad.setAttribute('cy', '50%');
        linearGrad.setAttribute('r', '25%');

        var colorStops = [
            ['0%', '#eab308'],
            ['25%', '#ef4444'],
            ['50%', '#80eeb4'],
            ['75%', '#06b6d4'],
            ['100%', '#8b5cf6']
        ];

        var stopEls = colorStops.map(function (pair) {
            var s = document.createElementNS(svgNS, 'stop');
            s.setAttribute('offset', pair[0]);
            s.setAttribute('stop-color', pair[1]);
            s.style.transition = 'opacity 0.3s';
            s.style.opacity = '0';
            return s;
        });
        stopEls.forEach(function (s) { linearGrad.appendChild(s); });
        defs.appendChild(linearGrad);

        // Radial gradient for mask (follows cursor)
        var radialGrad = document.createElementNS(svgNS, 'radialGradient');
        radialGrad.setAttribute('id', 'footerRevealMask');
        radialGrad.setAttribute('gradientUnits', 'userSpaceOnUse');
        radialGrad.setAttribute('r', '20%');
        radialGrad.setAttribute('cx', '50%');
        radialGrad.setAttribute('cy', '50%');
        radialGrad.style.transition = 'all 0.1s ease-out';

        var ms1 = document.createElementNS(svgNS, 'stop');
        ms1.setAttribute('offset', '0%');
        ms1.setAttribute('stop-color', 'white');
        var ms2 = document.createElementNS(svgNS, 'stop');
        ms2.setAttribute('offset', '100%');
        ms2.setAttribute('stop-color', 'black');
        radialGrad.appendChild(ms1);
        radialGrad.appendChild(ms2);
        defs.appendChild(radialGrad);

        // Mask
        var mask = document.createElementNS(svgNS, 'mask');
        mask.setAttribute('id', 'footerTextMask');
        var maskRect = document.createElementNS(svgNS, 'rect');
        maskRect.setAttribute('x', '0');
        maskRect.setAttribute('y', '0');
        maskRect.setAttribute('width', '100%');
        maskRect.setAttribute('height', '100%');
        maskRect.setAttribute('fill', 'url(#footerRevealMask)');
        mask.appendChild(maskRect);
        defs.appendChild(mask);

        svg.appendChild(defs);

        var fontStyles = 'font-family: Helvetica, Arial, sans-serif; font-size: 72px; font-weight: bold;';

        // Text 1: Outline (opacity changes on hover)
        var text1 = document.createElementNS(svgNS, 'text');
        text1.setAttribute('x', '50%');
        text1.setAttribute('y', '50%');
        text1.setAttribute('text-anchor', 'middle');
        text1.setAttribute('dominant-baseline', 'middle');
        text1.setAttribute('stroke-width', '0.3');
        text1.setAttribute('fill', 'transparent');
        text1.setAttribute('stroke', 'rgba(229,231,235,0.15)');
        text1.style.cssText = fontStyles + 'opacity:0;transition:opacity 0.3s;';
        text1.textContent = text;
        svg.appendChild(text1);

        // Text 2: Animated stroke draw
        var text2 = document.createElementNS(svgNS, 'text');
        text2.setAttribute('x', '50%');
        text2.setAttribute('y', '50%');
        text2.setAttribute('text-anchor', 'middle');
        text2.setAttribute('dominant-baseline', 'middle');
        text2.setAttribute('stroke-width', '0.3');
        text2.setAttribute('fill', 'transparent');
        text2.setAttribute('stroke', '#3ca2fa');
        text2.style.cssText = fontStyles + 'stroke-dasharray:1000;stroke-dashoffset:1000;animation:footerStrokeDraw 4s ease-in-out forwards;';
        text2.textContent = text;
        svg.appendChild(text2);

        // Text 3: Gradient fill (masked by cursor-following radial gradient)
        var text3 = document.createElementNS(svgNS, 'text');
        text3.setAttribute('x', '50%');
        text3.setAttribute('y', '50%');
        text3.setAttribute('text-anchor', 'middle');
        text3.setAttribute('dominant-baseline', 'middle');
        text3.setAttribute('stroke-width', '0.3');
        text3.setAttribute('fill', 'transparent');
        text3.setAttribute('stroke', 'url(#footerTextGradient)');
        text3.setAttribute('mask', 'url(#footerTextMask)');
        text3.style.cssText = fontStyles;
        text3.textContent = text;
        svg.appendChild(text3);

        container.appendChild(svg);

        // Hover events
        svg.addEventListener('mouseenter', function () {
            text1.style.opacity = '0.7';
            stopEls.forEach(function (s) { s.style.opacity = '1'; });
        });

        svg.addEventListener('mouseleave', function () {
            text1.style.opacity = '0';
            stopEls.forEach(function (s) { s.style.opacity = '0'; });
        });

        svg.addEventListener('mousemove', function (e) {
            var rect = svg.getBoundingClientRect();
            var cxPct = ((e.clientX - rect.left) / rect.width) * 100;
            var cyPct = ((e.clientY - rect.top) / rect.height) * 100;
            radialGrad.setAttribute('cx', cxPct + '%');
            radialGrad.setAttribute('cy', cyPct + '%');
        });
    });
})();
