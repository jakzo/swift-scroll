import { DOM } from './dom-abstraction';

export default {

  // Hack to listen for DOM element resize
  // TODO: Maybe throttle...
  listenForResize: (element, callback) => {

    const size = 99999; // must be greater than max element height/width
    let previousWidth = 0,
        previousHeight = 0;

    // Checks if the size of the element has changed
    const checkForResize = (e) => {
      const box = element.getBoundingClientRect(),
            width = box.width,
            height = box.height;
      // Keep expandOuter and shrinkOuter fully scrolled
      expandOuter.scrollLeft =
      expandOuter.scrollTop =
      shrinkOuter.scrollLeft =
      shrinkOuter.scrollTop = size;
      // Fire the callback if the size of the element has changed
      if (width != previousWidth || height != previousHeight) {
        previousWidth = width;
        previousHeight = height;
        if (e) callback(width, height);
      }
    };

    /*
     * expandOuter will automatically scroll when the element (and therefore
     * expandOuter) becomes larger because expandOuter is scrolled all the
     * way to its scrollWidth and scrollHeight, and when expandOuter becomes
     * larger, more of expandInner is visible which causes the scrollWidth
     * and scrollHeight of expandOuter to decrease.
     */
    const expandOuter = document.createElement('div'),
          expandInner = document.createElement('div');
    expandInner.style.width =
    expandInner.style.height = size + 'px';
    DOM.appendChild.value.call(expandOuter, expandInner);

    /*
     * shrinkOuter will automatically scroll when the element (and therefore
     * shrinkOuter) becomes smaller because shrinkOuter is scrolled all the
     * way to its scrollWidth and scrollHeight, and when shrinkOuter becomes
     * smaller, the size of shrinkInner decreases at twice the rate which
     * causes the scrollWidth and scrollHeight of shrinkOuter to decrease.
     */
    const shrinkOuter = document.createElement('div'),
          shrinkInner = document.createElement('div');
    shrinkInner.style.width =
    shrinkInner.style.height = '200%';
    DOM.appendChild.value.call(shrinkOuter, shrinkInner);

    // Set outer styles and add them to the page (off-screen top-left)
    expandOuter.style.cssText = shrinkOuter.style.cssText = [
      `position: absolute;`,
      `left: ${-size * 2}px;`,
      `top: ${-size * 2}px;`,
      `width: 100%;`,
      `height: 100%;`,
      `overflow: hidden;`
    ].join(' ');
    DOM.appendChild.value.call(element, expandOuter);
    DOM.appendChild.value.call(element, shrinkOuter);
    expandOuter.addEventListener('scroll', checkForResize, false);
    shrinkOuter.addEventListener('scroll', checkForResize, false);

    // Set initial scroll positions
    checkForResize();
  }
}
