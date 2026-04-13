const evaluateGradientColor = (colors, value) => {

    const segment = (colors.length - 1) * value;
    const index = Math.floor(segment);
    const fraction = segment - index;

    const color1 = colors[index];
    const color2 = colors[Math.min(index + 1, colors.length - 1)];

    const toRGB = hex => hex.match(/\w\w/g).map(x => parseInt(x, 16));

    const rgb1 = toRGB(color1);
    const rgb2 = toRGB(color2);

    const resultRGB = rgb1.map((c1, i) => Math.round(c1 + (rgb2[i] - c1) * fraction));
    return "#" + resultRGB.map(c => c.toString(16).padStart(2, '0')).join('');

}

export {
    evaluateGradientColor
}