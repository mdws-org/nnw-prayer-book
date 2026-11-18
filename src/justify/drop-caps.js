// Written by tools/fit_drop_caps.mjs; do not edit by hand.
//
// For each capital: [fit, lead]. fit is the right margin of the drop cap in
// its own em, which is where line 2 starts. lead is where line 1 starts from
// there, in em of the body text: negative where the opening word runs in over
// the capital's leg or foot. NARROW is for a phone's leading, WIDE for the
// Mac's; TOP is the space above the capital, in its own em, that stands its
// foot on line 2's baseline. The distances behind them are in the script.
var FIT_NARROW = {
    A: [0.1196, -1.010],
    B: [0.0178, -0.048],
    C: [-0.0239, 0.064],
    D: [0.0211, 0.038],
    E: [0.0330, -0.043],
    F: [-0.0423, 0.084],
    G: [0.0016, -0.119],
    H: [-0.0049, -0.156],
    I: [0.0189, -0.271],
    J: [-0.0800, 0.089],
    K: [0.0450, -0.554],
    L: [0.0820, -1.216],
    M: [-0.0124, -0.255],
    N: [-0.0792, 0.064],
    O: [0.0160, -0.035],
    P: [-0.0736, 0.373],
    Q: [0.0254, -0.167],
    R: [0.0400, -0.658],
    S: [0.0146, -0.095],
    T: [-0.0514, 0.222],
    U: [-0.0705, 0.144],
    V: [-0.0597, -0.003],
    W: [-0.0479, 0.010],
    X: [0.0271, -0.332],
    Y: [-0.0212, -0.023],
    Z: [0.0316, -0.120],
};
var FIT_WIDE = {
    A: [0.1157, -1.049],
    B: [0.0188, -0.051],
    C: [-0.0221, 0.058],
    D: [0.0224, -0.046],
    E: [0.0345, -0.046],
    F: [-0.0412, 0.084],
    G: [0.0021, -0.119],
    H: [-0.0071, 0.116],
    I: [0.0161, 0.043],
    J: [-0.0796, 0.365],
    K: [0.0408, -0.069],
    L: [0.0825, -0.867],
    M: [-0.0162, 0.074],
    N: [-0.0789, 0.360],
    O: [0.0174, -0.118],
    P: [-0.0700, 0.359],
    Q: [0.0268, -0.250],
    R: [0.0410, -0.660],
    S: [0.0140, -0.094],
    T: [-0.0542, 0.270],
    U: [-0.0683, 0.385],
    V: [-0.0381, 0.232],
    W: [-0.0283, 0.226],
    X: [0.0229, -0.024],
    Y: [-0.0192, 0.285],
    Z: [0.0318, -0.003],
};
var TOP_NARROW = 0.0215;
var TOP_WIDE = 0.0585;

// After a one-letter word ("A voice") line 1 keeps a thin space in place of
// the word space, as the 2019 St. Tikhon's prayer book sets it.
var ONE_LETTER_LEAD = 0.16;
