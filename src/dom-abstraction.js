if (!window._swiftScroll) {
  /**
   * Overrides DOM manipulation properties and methods to allow regular DOM
   * manipulation code to interact with the container DOM as if SwiftScroll was
   * not altering the DOM at all.
   * It does this by wrapping the built-in DOM manipulation functions and
   * properties with functions that check if work needs to be done to produce the
   * correct result.
   *
   * Notes about properties:
   * childNodes - returns an array instead of a NodeList, do not edit the array
   * children - returns an array instead of an HTMLCollection, do not edit
   *
   * cloneNode() - cloned nodes do *not* have SwiftScroll rendering applied
   * shadowRoot - container.shadowRoot not supported, cannot work with shadow DOM
   * attachShadow() - container.attachShadow not supported, cannot work with shadow DOM
   * createShadowRoot() - container.createShadowRoot not supported, cannot work with shadow DOM, also deprecated
   *
   * Arrays should work fine instead of NodeLists in most cases.
   * All properties and methods were collected from the properties and methods
   * of an instance of HTMLElement.
   *
   * The structure of the `wrappers` object is:
   * ClassName: {
   *   classPrototypePropertyName: {
   *     // Separate descriptor definitions for each type of SwiftScroll DOM node.
   *     // It can either be an object with a `get` or `set` function, or instead
   *     // of an object, a function. Only one handler is called. Handlers
   *     // higher in this list take priority.
   *     get: {
   *       // Handler for swiftScroll.container
   *       container: (swiftScrollInstance, ...params) => { ... },
   *       // Handler for direct child nodes of container
   *       child: (ss, originalFunc, leaf, element, ...params) => { ... },
   *       // Handler for descendants of container nodes
   *       descendant: (ss, originalFunc, leaf, element, ...params) => { ... },
   *       // Handler for ancestors of container nodes
   *       ancestor: (originalFunc, element, ...params) => { ... },
   *       // Handler for all DOM nodes (inside SwiftScroll container or not)
   *       all: (originalFunc, element, ...params) => { ... }
   *     },
   *     set: { ... },
   *     value: { ... }
   *   }
   * }
   */

  // Common function which adds a descendant node's leaf to the DOM before
  // executing the original function (mostly for measurement properties)
  const addToDOMFirst = (ss, originalFunc, leaf, element, ...params) => {
    const noParent = !DOM.parentNode.get.call(leaf.element);
    if (noParent) DOM.appendChild.value.call(ss.viewport, leaf.element);
    originalFunc.call(element, ...params);
    if (noParent) DOM.removeChild.value.call(ss.viewport, leaf.element);
  };

  // Finds the position of a child element in the child element array
  const findElementPosition = (element, arrName) => {
    const leaf = DOM.parentNode.get.call(element)._swiftScrollLeaf;
  };

  // Finds the root node while taking hidden container children into account
  const getRootNode = (ss, originalFunc, leaf, element, options) => {
    const root = DOM.getRootNode.value.call(element, options);
    if (root._swiftScrollLeaf) return ss.container.getRootNode(options);
    return root;
  };

  // TODO: Are there any events I need to abstract? DOM manipulation...?
  // TODO: Abstract global methods like document.getElementById (for leaves), getComputedStyle...
  // TODO: Abstract leaf node elements...
  const wrappers = {
    Node: {
      childNodes: {
        get: { container: ss => ss.dom.childNodes }
      },
      firstChild: {
        get: { container: ss => ss.dom.childNodes[0] }
      },
      lastChild: {
        get: {
          container: ss => ss.dom.childNodes[ss.dom.childNodes.length - 1]
        }
      },
      nextSibling: {
        get: {
          child: (ss, originalFunc, leaf, element) => {
            let nextSibling = DOM.nextSibling.get.call(element);
            if (nextSibling == null) {
              leaf = ss._siblingLeaf(leaf);
              if (leaf) nextSibling = DOM.firstChild.get.call(leaf.element);
            }
            return nextSibling || null;
          }
        }
      },
      parentNode: {
        get: { child: ss => ss.container }
      },
      parentElement: {
        get: { child: ss => ss.container }
      },
      previousSibling: {
        get: {
          child: (ss, originalFunc, leaf, element) => {
            let previousSibling = DOM.previousSibling.get.call(element);
            if (previousSibling == null) {
              leaf = ss._siblingLeaf(leaf, true);
              if (leaf) previousSibling = DOM.lastChild.get.call(leaf.element);
            }
            return previousSibling || null;
          }
        }
      },
      textContent: {
        get: {
          container: ss => {
            return ss.dom.childNodes
              .map(node => DOM.textContent.get.call(node))
              .join("");
          },
          ancestor: (originalFunc, element) => {
            const stack = [[element.childNodes, -1]],
              text = [];
            while (stack.length != 0) {
              const item = stack[stack.length - 1];
              if (++item[1] >= item[0].length) {
                stack.pop();
              } else {
                const nextNode = item[0][item[1]];
                if (nextNode._swiftScroll) {
                  text.push(nextNode.textContent);
                } else if (nextNode.nodeType == 3) {
                  text.push(nextNode.data);
                } else {
                  stack.push([nextNode.childNodes, -1]);
                }
              }
            }
            return text.join("");
          }
        },
        set: {
          container: (ss, text) => {
            ss.clear();
            ss.append(document.createTextNode(text));
          }
        }
      },
      rootNode: {
        get: { child: getRootNode, descendant: getRootNode }
      },

      getRootNode: {
        get: { child: getRootNode, descendant: getRootNode }
      },

      appendChild: {},
      removeChild: {},
      insertBefore: {},
      // TODO: Make deep default to whichever the browser default is...
      cloneNode: {
        value: {
          container: (ss, deep = false) => {
            const cloned = Node.prototype.cloneNode.call(ss.container, false);
            if (deep) {
              ss.dom.childNodes.forEach(node => {
                cloned.appendChild(node.cloneNode(true));
              });
            }
            return cloned;
          }
        }
      }
    },
    Element: {
      childElementCount: {
        get: { container: ss => ss.dom.childNodes.length }
      },
      children: {
        get: { container: ss => ss.dom.children }
      },
      clientHeight: {
        get: { descendant: addToDOMFirst }
      },
      clientLeft: {
        get: { descendant: addToDOMFirst }
      },
      clientTop: {
        get: { descendant: addToDOMFirst }
      },
      clientWidth: {
        get: { descendant: addToDOMFirst }
      },
      firstElementChild: {
        get: { container: ss => ss.dom.children[0] }
      },
      lastElementChild: {
        get: { container: ss => ss.dom.children[ss.dom.children.length - 1] }
      },
      append: {
        value: {
          container: (ss, ...nodes) => {
            // TODO: Maybe I should make a "bulk" ss.append function...?
            nodes.forEach(node => {
              if (!(node instanceof Node)) {
                node = document.createTextNode(String(node));
              }
              ss.append(node);
            });
          }
        }
      },
      insertAdjacentElement: {
        value: {
          container: (ss, position, element) => {
            if (position == "beforeend") {
              ss.append(element);
            } else if (position == "afterbegin") {
              ss.insertAt(element, 0);
            } else {
              const realFunction = DOM.insertAdjacentElement.value;
              return realFunction.call(ss.container, position, element);
            }
            return element;
          }
        }
      },
      insertAdjacentText: {
        value: {
          container: (ss, position, text) => {
            if (position == "beforeend") {
              ss.append(document.createTextNode(text));
            } else if (position == "afterbegin") {
              ss.insertAt(document.createTextNode(text), 0);
            } else {
              const realFunction = DOM.insertAdjacentText.value;
              realFunction.call(ss.container, position, html);
            }
          }
        }
      },
      prepend: {
        value: {
          container: (ss, ...nodes) => {
            let index = 0;
            nodes.forEach(node => {
              if (!(node instanceof Node)) {
                node = document.createTextNode(String(node));
              }
              ss.insertAt(node, index++);
            });
          }
        }
      },
      // TODO: These...
      innerHTML: {
        get: { container: ss => "" },
        set: { container: (ss, html) => {} }
      },
      outerHTML: {
        get: { container: ss => "" },
        set: { container: (ss, html) => {} }
      },
      innerText: {
        get: { container: ss => "" },
        set: { container: (ss, html) => {} }
      },
      outerText: {
        get: { container: ss => "" },
        set: { container: (ss, html) => {} }
      },
      textContent: {
        get: { container: ss => "" },
        set: { container: (ss, html) => {} }
      },
      insertAdjacentHTML: {
        value: {
          container: (ss, position, html) => {
            if (position == "beforeend") {
              parseHtml(html).forEach(element => ss.append(elements[i]));
            } else if (position == "afterbegin") {
              parseHtml(html).forEach(element => ss.insertAt(elements[i], 0));
            } else {
              const realFunction = DOM.insertAdjacentHTML.value;
              realFunction.call(ss.container, position, html);
            }
          }
        }
      }
    }
  };

  const wrap = (originalFunc, handlers) => {
    // TODO: Is the rest operator safe to use performance wise...?
    return function(...params) {
      // Execute the container handler first
      if (handlers.container && this._swiftScroll) {
        // Child containers also have ._swiftScroll set, but they should never
        // be accessible outside of the SwiftScroll code
        // TODO: Stop child containers from being accessible...
        if (this._swiftScroll.container != this) {
          console.warn("SwiftScroll: Rogue container found:", this);
          return;
        }
        return handlers.container(this._swiftScroll, ...params);
      }

      // Execute the child handler next
      const parentNode = DOM.parentNode.get.call(this);
      if (handlers.child && parentNode && parentNode._swiftScrollLeaf) {
        const leaf = parentNode._swiftScrollLeaf;
        return handlers.child(leaf.ss, originalFunc, leaf, this, ...params);
      }

      // Execute ancestor handler
      if (handlers.ancestor) {
        for (let i = 0; i < visibleContainers.length; i++) {
          if (this.contains(visibleContainers[i])) {
            return handlers.ancestor(originalFunc, this, ...params);
          }
        }
      }

      return originalFunc.apply(this, params);
    };
  };

  /*
   * Wrap the properties and methods of the DOM classes with SwiftScroll code.
   * If the property or method is not supported by the browser, it is not wrapped.
   */
  const DOM = {},
    visibleContainers = [];
  window._swiftScroll = {
    overiddenDOMProperties: DOM,
    // We only want references to SwiftScroll instances which are connected to the
    // document so they can be garbage collected if their containers have been
    // discarded.
    visibleContainers: visibleContainers,
    checkContainerVisibility: container => {
      const index = visibleContainers.indexOf(container);
      // TODO: IE supports document.contains right...?
      if (document.contains(container)) {
        if (index < 0) visibleContainers.push(container);
      } else {
        if (index >= 0) visibleContainers.splice(index, 1);
      }
    }
  };
  for (const className in wrappers) {
    const domClass = window[className],
      prototype = domClass.prototype,
      properties = wrappers[className];
    for (const prop in properties) {
      if (prototype.hasOwnProperty(prop)) {
        const originalProp = Object.getOwnPropertyDescriptor(prototype, prop),
          definition = properties[prop],
          descriptor = {};
        for (const key in originalProp) {
          descriptor[key] = originalProp[key];
        }
        DOM[prop] = originalProp;
        // Pass a reference to the SwiftScroll instance into any functions
        for (const key in definition) {
          if (/get|set|value/.test(key)) {
            descriptor[key] = wrap(originalProp[key], definition[key]);
          } else {
            descriptor[key] = definition[key];
          }
        }
        Object.defineProperty(prototype, prop, descriptor);
      }
    }
  }
}

const DOM = window._swiftScroll.overiddenDOMProperties,
  checkContainerVisibility = window._swiftScroll.checkContainerVisibility;
export { DOM, checkContainerVisibility };
