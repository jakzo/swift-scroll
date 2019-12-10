// SwiftScroll, copyright (c) jakzo, MIT licensed
(function(global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? (module.exports = factory())
    : typeof define === "function" && define.amd
    ? define(factory)
    : (global.SwiftScroll = factory());
})(this, function() {
  "use strict";

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
    var addToDOMFirst = function addToDOMFirst(
      ss,
      originalFunc,
      leaf,
      element
    ) {
      for (
        var _len = arguments.length,
          params = Array(_len > 4 ? _len - 4 : 0),
          _key = 4;
        _key < _len;
        _key++
      ) {
        params[_key - 4] = arguments[_key];
      }

      var noParent = !_DOM.parentNode.get.call(leaf.element);
      if (noParent) _DOM.appendChild.value.call(ss.viewport, leaf.element);
      originalFunc.call.apply(originalFunc, [element].concat(params));
      if (noParent) _DOM.removeChild.value.call(ss.viewport, leaf.element);
    };

    // Finds the position of a child element in the child element array
    var findElementPosition = function findElementPosition(element, arrName) {
      var leaf = _DOM.parentNode.get.call(element)._swiftScrollLeaf;
    };

    // TODO: Are there any events I need to abstract...?
    // TODO: Abstract global methods like document.getElementById (for leaves), getComputedStyle...
    // TODO: Abstract leaf node elements...
    var wrappers = {
      Node: {
        childNodes: {
          get: {
            container: function container(ss) {
              return ss.dom.childNodes;
            }
          }
        },
        firstChild: {
          get: {
            container: function container(ss) {
              return ss.dom.childNodes[0];
            }
          }
        },
        lastChild: {
          get: {
            container: function container(ss) {
              return ss.dom.childNodes[ss.dom.childNodes.length - 1];
            }
          }
        },
        nextSibling: {
          get: {
            child: function child(ss, originalFunc, leaf, element) {
              var nextSibling = _DOM.nextSibling.get.call(element);
              if (nextSibling == null) {
                leaf = ss._siblingLeaf(leaf);
                if (leaf) nextSibling = _DOM.firstChild.get.call(leaf.element);
              }
              return nextSibling || null;
            }
          }
        },
        parentNode: {
          get: {
            child: function child(ss) {
              return ss.container;
            }
          }
        },
        parentElement: {
          get: {
            child: function child(ss) {
              return ss.container;
            }
          }
        },
        previousSibling: {
          get: {
            child: function child(ss, originalFunc, leaf, element) {
              var previousSibling = _DOM.previousSibling.get.call(element);
              if (previousSibling == null) {
                leaf = ss._siblingLeaf(leaf, true);
                if (leaf)
                  previousSibling = _DOM.lastChild.get.call(leaf.element);
              }
              return previousSibling || null;
            }
          }
        },
        textContent: {
          get: {
            container: function container(ss) {
              return ss.dom.childNodes
                .map(function(node) {
                  return _DOM.textContent.get.call(node);
                })
                .join("");
            },
            ancestor: function ancestor(originalFunc, element) {
              var stack = [[element.childNodes, -1]],
                text = [];
              while (stack.length != 0) {
                var item = stack[stack.length - 1];
                if (++item[1] >= item[0].length) {
                  stack.pop();
                } else {
                  var nextNode = item[0][item[1]];
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
            container: function container(ss, text) {
              ss.clear();
              ss.append(document.createTextNode(text));
            }
          }
        },

        appendChild: {},
        removeChild: {},
        insertBefore: {},
        // TODO: Make deep default to whichever the browser default is...
        cloneNode: {
          value: {
            container: function container(ss) {
              var deep =
                arguments.length > 1 && arguments[1] !== undefined
                  ? arguments[1]
                  : false;

              var cloned = Node.prototype.cloneNode.call(ss.container, false);
              if (deep) {
                ss.dom.childNodes.forEach(function(node) {
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
          get: {
            container: function container(ss) {
              return ss.dom.childNodes.length;
            }
          }
        },
        children: {
          get: {
            container: function container(ss) {
              return ss.dom.children;
            }
          }
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
          get: {
            container: function container(ss) {
              return ss.dom.children[0];
            }
          }
        },
        lastElementChild: {
          get: {
            container: function container(ss) {
              return ss.dom.children[ss.dom.children.length - 1];
            }
          }
        },
        append: {
          value: {
            container: function container(ss) {
              for (
                var _len2 = arguments.length,
                  nodes = Array(_len2 > 1 ? _len2 - 1 : 0),
                  _key2 = 1;
                _key2 < _len2;
                _key2++
              ) {
                nodes[_key2 - 1] = arguments[_key2];
              }

              // TODO: Maybe I should make a "bulk" ss.append function...?
              nodes.forEach(function(node) {
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
            container: function container(ss, position, element) {
              if (position == "beforeend") {
                ss.append(element);
              } else if (position == "afterbegin") {
                ss.insertAt(element, 0);
              } else {
                var realFunction = _DOM.insertAdjacentElement.value;
                return realFunction.call(ss.container, position, element);
              }
              return element;
            }
          }
        },
        insertAdjacentText: {
          value: {
            container: function container(ss, position, text) {
              if (position == "beforeend") {
                ss.append(document.createTextNode(text));
              } else if (position == "afterbegin") {
                ss.insertAt(document.createTextNode(text), 0);
              } else {
                var realFunction = _DOM.insertAdjacentText.value;
                realFunction.call(ss.container, position, html);
              }
            }
          }
        },
        prepend: {
          value: {
            container: function container(ss) {
              for (
                var _len3 = arguments.length,
                  nodes = Array(_len3 > 1 ? _len3 - 1 : 0),
                  _key3 = 1;
                _key3 < _len3;
                _key3++
              ) {
                nodes[_key3 - 1] = arguments[_key3];
              }

              var index = 0;
              nodes.forEach(function(node) {
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
          get: {
            container: function container(ss) {
              return "";
            }
          },
          set: { container: function container(ss, html) {} }
        },
        outerHTML: {
          get: {
            container: function container(ss) {
              return "";
            }
          },
          set: { container: function container(ss, html) {} }
        },
        innerText: {
          get: {
            container: function container(ss) {
              return "";
            }
          },
          set: { container: function container(ss, html) {} }
        },
        outerText: {
          get: {
            container: function container(ss) {
              return "";
            }
          },
          set: { container: function container(ss, html) {} }
        },
        textContent: {
          get: {
            container: function container(ss) {
              return "";
            }
          },
          set: { container: function container(ss, html) {} }
        },
        insertAdjacentHTML: {
          value: {
            container: function container(ss, position, html) {
              if (position == "beforeend") {
                parseHtml(html).forEach(function(element) {
                  return ss.append(elements[i]);
                });
              } else if (position == "afterbegin") {
                parseHtml(html).forEach(function(element) {
                  return ss.insertAt(elements[i], 0);
                });
              } else {
                var realFunction = _DOM.insertAdjacentHTML.value;
                realFunction.call(ss.container, position, html);
              }
            }
          }
        }
      }
    };

    var wrap = function wrap(originalFunc, handlers) {
      // TODO: Is the rest operator safe to use performance wise...?
      return function() {
        for (
          var _len4 = arguments.length, params = Array(_len4), _key4 = 0;
          _key4 < _len4;
          _key4++
        ) {
          params[_key4] = arguments[_key4];
        }

        // Execute the container handler first
        if (handlers.container && this._swiftScroll) {
          // Child containers also have ._swiftScroll set, but they should never
          // be accessible outside of the SwiftScroll code
          // TODO: Stop child containers from being accessible...
          if (this._swiftScroll.container != this) {
            console.warn("SwiftScroll: Rogue container found:", this);
            return;
          }
          return handlers.container.apply(
            handlers,
            [this._swiftScroll].concat(params)
          );
        }

        // Execute the child handler next
        var parentNode = _DOM.parentNode.get.call(this);
        if (handlers.child && parentNode && parentNode._swiftScrollLeaf) {
          var leaf = parentNode._swiftScrollLeaf;
          return handlers.child.apply(
            handlers,
            [leaf.ss, originalFunc, leaf, this].concat(params)
          );
        }

        // Execute ancestor handler
        if (handlers.ancestor) {
          for (var _i = 0; _i < visibleContainers.length; _i++) {
            if (this.contains(visibleContainers[_i])) {
              return handlers.ancestor.apply(
                handlers,
                [originalFunc, this].concat(params)
              );
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
    var _DOM = {},
      visibleContainers = [];
    window._swiftScroll = {
      overiddenDOMProperties: _DOM,
      // We only want references to SwiftScroll instances which are connected to the
      // document so they can be garbage collected if their containers have been
      // discarded.
      visibleContainers: visibleContainers,
      // TODO: Call this when the container is removed from the tree using DOM
      //       manipulation events...
      checkContainerVisibility: function checkContainerVisibility(container) {
        var index = visibleContainers.indexOf(container);
        // TODO: IE supports document.contains right...?
        if (document.contains(container)) {
          if (index < 0) visibleContainers.push(container);
        } else {
          if (index >= 0) visibleContainers.splice(index, 1);
        }
      }
    };
    for (var className in wrappers) {
      var domClass = window[className],
        prototype = domClass.prototype,
        properties = wrappers[className];
      for (var prop in properties) {
        if (prototype.hasOwnProperty(prop)) {
          var originalProp = Object.getOwnPropertyDescriptor(prototype, prop),
            definition = properties[prop],
            descriptor = {};
          for (var key in originalProp) {
            descriptor[key] = originalProp[key];
          }
          _DOM[prop] = originalProp;
          // Pass a reference to the SwiftScroll instance into any functions
          for (var _key5 in definition) {
            if (/get|set|value/.test(_key5)) {
              descriptor[_key5] = wrap(originalProp[_key5], definition[_key5]);
            } else {
              descriptor[_key5] = definition[_key5];
            }
          }
          Object.defineProperty(prototype, prop, descriptor);
        }
      }
    }
  }

  var DOM = window._swiftScroll.overiddenDOMProperties;
  var checkContainerVisibility = window._swiftScroll.checkContainerVisibility;

  var Util = {
    // Hack to listen for DOM element resize
    // TODO: Maybe throttle...
    listenForResize: function listenForResize(element, callback) {
      var size = 99999; // must be greater than max element height/width
      var previousWidth = 0,
        previousHeight = 0;

      // Checks if the size of the element has changed
      var checkForResize = function checkForResize(e) {
        var box = element.getBoundingClientRect(),
          width = box.width,
          height = box.height;
        // Keep expandOuter and shrinkOuter fully scrolled
        expandOuter.scrollLeft = expandOuter.scrollTop = shrinkOuter.scrollLeft = shrinkOuter.scrollTop = size;
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
      var expandOuter = document.createElement("div"),
        expandInner = document.createElement("div");
      expandInner.style.width = expandInner.style.height = size + "px";
      DOM.appendChild.value.call(expandOuter, expandInner);

      /*
       * shrinkOuter will automatically scroll when the element (and therefore
       * shrinkOuter) becomes smaller because shrinkOuter is scrolled all the
       * way to its scrollWidth and scrollHeight, and when shrinkOuter becomes
       * smaller, the size of shrinkInner decreases at twice the rate which
       * causes the scrollWidth and scrollHeight of shrinkOuter to decrease.
       */
      var shrinkOuter = document.createElement("div"),
        shrinkInner = document.createElement("div");
      shrinkInner.style.width = shrinkInner.style.height = "200%";
      DOM.appendChild.value.call(shrinkOuter, shrinkInner);

      // Set outer styles and add them to the page (off-screen top-left)
      expandOuter.style.cssText = shrinkOuter.style.cssText = [
        "position: absolute;",
        "left: " + -size * 2 + "px;",
        "top: " + -size * 2 + "px;",
        "width: 100%;",
        "height: 100%;",
        "overflow: hidden;"
      ].join(" ");
      DOM.appendChild.value.call(element, expandOuter);
      DOM.appendChild.value.call(element, shrinkOuter);
      expandOuter.addEventListener("scroll", checkForResize, false);
      shrinkOuter.addEventListener("scroll", checkForResize, false);

      // Set initial scroll positions
      checkForResize();
    }
  };

  var classCallCheck = function(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  var createClass = (function() {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function(Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  })();

  var toConsumableArray = function(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++)
        arr2[i] = arr[i];

      return arr2;
    } else {
      return Array.from(arr);
    }
  };

  /*
   * === How it Works ===
   * First the SwiftScroll class is instantiated.
   * The DOM element which contains the large amount of DOM nodes to be rendered
   * efficiently is called the "source element".
   * The DOM nodes are stored within a B-tree structure containing "leaf nodes"
   * (nodes which contain DOM elements), "branch nodes" (nodes which contain leaf
   * nodes or more branch nodes) and a special type of branch node called a "root
   * node" (the top-level node which contains all other nodes).
   * The DOM nodes within the source element are split into block-level elements.
   * All block-level elements (eg. <div>s, <p>s, etc) have their own leaf node.
   * All inline nodes between block-level elements are put together in a leaf node
   * (eg. in "<div></div>a<i>b</i><sup>c</sup><div></div>" there are three leaf
   * nodes: "<div></div>", "a<i>b</i><sup>c</sup>" and "<div></div>").
   * The DOM elements within each leaf node are initially removed from the DOM.
   * As the source element scrolls, leaf nodes which are about to come into view
   * are added to the source element's DOM, and ones leaving view are removed.
   */

  /**
   * Main SwiftScroll class.
   * @param {Object} options SwiftScroll configuration options.
   */

  var SwiftScroll = (function() {
    function SwiftScroll(_ref) {
      var _this = this;

      var _ref$container = _ref.container,
        container =
          _ref$container === undefined
            ? document.createElement("div")
            : _ref$container,
        _ref$nodeMaxChildren = _ref.nodeMaxChildren,
        nodeMaxChildren =
          _ref$nodeMaxChildren === undefined ? 20 : _ref$nodeMaxChildren,
        _ref$viewportBufferSi = _ref.viewportBufferSize,
        viewportBufferSize =
          _ref$viewportBufferSi === undefined ? 2000 : _ref$viewportBufferSi,
        _ref$backgroundUpdate = _ref.backgroundUpdateTime,
        backgroundUpdateTime =
          _ref$backgroundUpdate === undefined ? 20 : _ref$backgroundUpdate;
      classCallCheck(this, SwiftScroll);

      // Initialise settings
      this.nodeMaxChildren = nodeMaxChildren;
      this.viewportBufferSize = viewportBufferSize;
      this.backgroundUpdateTime = backgroundUpdateTime;

      // Set initial values
      this.rootNode = new TreeNode(this, null, []);
      this.state = 1;
      this.dom = {
        childNodes: [],
        children: []
      };

      // Create helper DOM elements
      this.container = container;
      this.container._swiftScroll = this;
      this.scroller = document.createElement("div");
      this.viewport = document.createElement("div");
      DOM.appendChild.value.call(this.scroller, this.viewport);
      this.updateQueue = [];
      checkContainerVisibility(this.container);

      // Put the DOM nodes already in the source element into the B-tree
      // TODO: See which one transpiles more efficiently...
      // const childNodes = Array.prototype.slice.call(this.container.childNodes);
      var childNodes = [].concat(toConsumableArray(this.container.childNodes));
      DOM.appendChild.value.call(this.container, this.scroller);
      childNodes.forEach(function(node) {
        DOM.removeChild.value.call(_this.container, node);
        _this.append(node);
      });

      // Register events
      this.container.addEventListener(
        "scroll",
        function(e) {
          _this._updateViewportPosition();
        },
        false
      );
      Util.listenForResize(this.container, function(width, height) {
        _this.state++;
        _this._updateViewportDimensions();
      });

      this._updateViewportDimensions();
    }

    /**
     * Adds a DOM node at the end of all the elements.
     * @param {Node} domNode DOM node to insert.
     */

    createClass(SwiftScroll, [
      {
        key: "append",
        value: function append(domNode) {
          var results = this._findLastLeaf();
          if (!results) {
            results = {
              node: new TreeNode(this, this.rootNode),
              childIndex: 0,
              index: 0,
              domChildNodes: 0,
              domChildren: 0,
              height: 0
            };
            this.rootNode.children.push(results.node);
          }
          this._insertNodeInLeaf(results, results.node.domChildNodes, domNode);
        }

        /**
         * Inserts a DOM node at a specific DOM childNode index.
         * @param {Node} domNode DOM node to insert.
         * @param {number} index container.childNodes[index] position to insert.
         */
      },
      {
        key: "insertAt",
        value: function insertAt(domNode, index) {
          if (index < 0) index = 0;
          var results = this._findLeaf("domChildNodes", index);
          if (results) {
            this._insertNodeInLeaf(
              results,
              index - results.domChildNodes,
              domNode
            );
          } else {
            this.append(domNode);
          }
        }
      },
      {
        key: "clear",
        value: function clear() {
          this.rootNode = new TreeNode(this, null, []);
          this.dom.childNodes = [];
          this.dom.children = [];
          this._scheduleUpdate("forceUpdateViewportPosition");
        }

        /* PRIVATE METHODS */

        /**
         * Inserts a DOM node at a child index of a TreeNode.
         * @param {Object} results The results object returned by a call to
         *     findLeaf().
         * @param {number} index Index within leaf.element.childNodes to add the node.
         * @param {Node} domNode DOM node to insert.
         */
      },
      {
        key: "_insertNodeInLeaf",
        value: function _insertNodeInLeaf(results, index, domNode) {
          // If the DOM node we are appending and leaf node are both inline,
          // insert the DOM node inside the leaf node's element
          if (index >= results.node.domChildNodes) {
            DOM.appendChild.value.call(results.node.element, domNode);
          } else {
            DOM.insertBefore.value.call(
              results.node.element,
              domNode,
              results.node.childNodes[index]
            );
          }

          // Update the leaf
          this._leafDomUpdated(results);
          // TODO: Only update if the viewport was changed...
          this._scheduleUpdate("forceUpdateViewportPosition");
        }

        /**
         * Call this every time a DOM element is added or removed from a leaf node, or
         * when the DOM has been changed somehow which may affect the leaf node (like
         * if the style of a block element became inline).
         * @param {Object} results A results object returned from findLeaf().
         */
      },
      {
        key: "_leafDomUpdated",
        value: function _leafDomUpdated(results) {
          var _this2 = this;

          // Count the number of DOM elements and nodes in this node
          // TODO: Spread...?
          var elementChildNodes = DOM.childNodes.get.call(results.node.element),
            elementChildren = DOM.children.get.call(results.node.element);
          var childNodes = Array.prototype.slice.call(elementChildNodes),
            children = Array.prototype.slice.call(elementChildren),
            addedChildNodes = childNodes.length - results.node.domChildNodes,
            addedChildren = children.length - results.node.domChildren,
            childNodesChanged =
              addedChildNodes != 0 ||
              childNodes.some(function(node, i) {
                return node != _this2.dom.childNodes[results.domChildNodes + i];
              }),
            childrenChanged =
              addedChildren != 0 ||
              children.some(function(node, i) {
                return node != _this2.dom.children[results.domChildren + i];
              });

          // Update the source element child lists
          if (childNodesChanged) {
            var _dom$childNodes;

            (_dom$childNodes = this.dom.childNodes).splice.apply(
              _dom$childNodes,
              [results.domChildNodes, results.node.domChildNodes].concat(
                toConsumableArray(childNodes)
              )
            );
          }
          if (childrenChanged) {
            var _dom$children;

            (_dom$children = this.dom.children).splice.apply(
              _dom$children,
              [results.domChildren, results.node.domChildren].concat(
                toConsumableArray(children)
              )
            );
          }

          // Add the number of added DOM nodes to this leaf and its ancestors
          if (childNodesChanged || childrenChanged) {
            var _node = results.node;
            while (_node) {
              _node.domChildNodes += addedChildNodes;
              _node.domChildren += addedChildren;
              _node = _node.parent;
            }
          }

          // Check if a block element has changed to inline or vice-versa
          var node = results.node,
            i = 0;
          this._addToUpdateQueue(node);
          while (i < elementChildNodes.length) {
            var child = elementChildNodes[i],
              isBlock = this._isBlockElement(child, node.element);

            // Split the leaf node if it contains incompatible elements
            if (i > 0) {
              if (isBlock || node.isBlock) {
                // Create the new leaf node
                var newNode = new TreeNode(this, node.parent);
                node.parent.children.splice(results.childIndex + 1, 0, newNode);
                newNode.isBlock = isBlock;
                // Add the elements to the new node
                while (elementChildNodes.length > i) {
                  var domNode = elementChildNodes[i];
                  DOM.removeChild.value.call(node.element, domNode);
                  DOM.appendChild.value.call(newNode.element, domNode);
                }
                // Update the DOM indices of the nodes
                elementChildNodes = DOM.childNodes.get.call(newNode.element);
                elementChildren = DOM.children.get.call(newNode.element);
                newNode.domChildNodes = elementChildNodes.length;
                newNode.domChildren = elementChildren.length;
                node.domChildNodes -= newNode.domChildNodes;
                node.domChildren -= newNode.domChildren;
                // Split the parent branch node if necessary then continue
                this._addToUpdateQueue(newNode);
                this._splitNode(node.parent);
                node = newNode;
                i = 0;
              }
            }

            // But if this is the first node, just change the leaf isBlock property
            else if (isBlock != node.isBlock) {
              node.isBlock = isBlock;
            }

            i++;
          }
        }

        /**
         * Splits a branch node and its parents if necessary.
         * Must be called whenever a tree node is added to a branch node.
         * @param {TreeNode} node
         */
      },
      {
        key: "_splitNode",
        value: function _splitNode(node) {
          var _this3 = this;

          var _loop = function _loop() {
            // If the root node needs to be split, create a new root node to be parent
            if (node == _this3.rootNode) {
              _this3.rootNode = new TreeNode(_this3, null, [node]);
              node.parent = _this3.rootNode;
              _this3._measure(_this3.rootNode);
            }

            // Split the node
            var half = (node.children.length / 2) | 0,
              children = node.children.slice(half),
              newNode = new TreeNode(_this3, node.parent, children),
              index = node.parent.children.indexOf(node) + 1;
            node.parent.children.splice(index, 0, newNode);
            children.forEach(function(child) {
              return (child.parent = newNode);
            });
            node.children = node.children.slice(0, half);
            _this3._measure(node);
            _this3._measure(newNode);

            node = node.parent;
          };

          while (node.children.length > this.nodeMaxChildren) {
            _loop();
          }
        }

        /**
         * Returns the leaf node where the sum of a certain property of all the nodes
         * before it is at least a certain value.
         * @param {string} property The property to cumulatively sum.
         * @param {number} value The minimum value of the sum. Returns the node which
         *     causes the sum to be greater than this value.
         * @return {Object} The search results. Includes all cumulative results as well
         *     as the found leaf node and its index within its parent's children.
         */
      },
      {
        key: "_findLeaf",
        value: function _findLeaf(property, value) {
          var results = {
            node: this.rootNode,
            childIndex: -1,
            index: 0,
            domChildNodes: 0,
            domChildren: 0,
            height: 0
          };
          var sum = 0;
          while (
            (results.node = results.node.parent.children[++results.childIndex])
          ) {
            var size = results.node[property];
            if (sum + size > value) {
              if (!results.node.children) return results;
              results.node = results.node.children[0];
              results.childIndex = -1;
            } else {
              sum += size;
              index += results.node.index;
              domChildNodes += results.node.domChildNodes;
              domChildren += results.node.domChildren;
              height += results.node.height;
            }
          }
          return null;
        }

        /**
         * Returns a search results object for the last leaf node in the tree.
         * @return {Object}
         */
      },
      {
        key: "_findLastLeaf",
        value: function _findLastLeaf() {
          if (this.rootNode.children.length == 0) return null;
          var node = this.rootNode,
            parent = void 0;
          while (node.children) {
            parent = node;
            node = node.children[node.children.length - 1];
          }
          return {
            node: node,
            childIndex: parent.children.indexOf(node),
            index: this.rootNode.index - node.index,
            domChildNodes: this.rootNode.domChildNodes - node.domChildNodes,
            domChildren: this.rootNode.domChildren - node.domChildren,
            height: this.rootNode.height - node.height
          };
        }

        /**
         * Returns the leaf node before or after the specified one.
         * @param {TreeNode} leaf
         * @param {?boolean} before=false Returns the leaf before the specified one.
         * @return {TreeNode}
         */
      },
      {
        key: "_siblingLeaf",
        value: function _siblingLeaf(leaf) {
          var before =
            arguments.length > 1 && arguments[1] !== undefined
              ? arguments[1]
              : false;

          var siblings = leaf.parent.children;
          while (siblings[before ? 0 : siblings.length - 1] == leaf) {
            leaf = leaf.parent;
            if (!leaf.parent) return null;
            siblings = leaf.parent.children;
          }
          leaf = siblings[siblings.indexOf(leaf) + (before ? -1 : 1)];
          while (leaf.children) {
            leaf = leaf.children[before ? leaf.children.length - 1 : 0];
          }
          return leaf;
        }

        // Checks if the viewport dimensions have changed
      },
      {
        key: "_updateViewportDimensions",
        value: function _updateViewportDimensions() {
          var width = DOM.clientWidth.get.call(this.container),
            height = DOM.clientHeight.get.call(this.container);
          if (width != this.viewportWidth || height != this.viewportHeight) {
            this.viewportWidth = width;
            this.viewportHeight = height;
            this._forceUpdateViewportPosition();
          }
        }

        // Removes all visible elements then redraws the viewport
      },
      {
        key: "_forceUpdateViewportPosition",
        value: function _forceUpdateViewportPosition() {
          var children = DOM.childNodes.get.call(this.viewport);
          while (children.length != 0) {
            DOM.removeChild.value.call(this.viewport, children[0]);
          }
          this.renderedTop = this.renderedBottom = -Infinity;
          this._updateViewportPosition();
        }

        // Checks if the currently visible elements need to be changed
      },
      {
        key: "_updateViewportPosition",
        value: function _updateViewportPosition() {
          var viewportHeight = this.viewportHeight,
            viewportTop = this.container.scrollTop,
            viewportBottom = viewportTop + viewportHeight,
            bufferSize = this.viewportBufferSize,
            limitViewportTop = this.renderedTop + bufferSize,
            limitViewportBottom = this.renderedBottom - bufferSize;
          this.viewportTop = viewportTop;

          if (
            viewportTop < limitViewportTop ||
            viewportBottom > limitViewportBottom
          ) {
            // Find the first leaf node which should be rendered at the current scroll
            var start = viewportTop - bufferSize * 2,
              end = viewportTop + viewportHeight + bufferSize * 2,
              nodeIndexStack = [];
            var children = this.rootNode.children,
              top = 0,
              c = 0,
              renderedTop = 0,
              renderedBottom = 0,
              node = void 0;
            while ((node = children[c++])) {
              if (top + node.height > start) {
                nodeIndexStack.push(c - 1);
                children = node.children;
                if (!children) break;
                c = 0;
              } else {
                top += node.height;
                renderedTop = top;
              }
            }
            this.viewport.style.paddingTop = top + "px";

            // Remove all currently visible lines initially
            // TODO: Leave lines which should still be visible...
            var viewportChildren = DOM.childNodes.get.call(this.viewport);
            while (viewportChildren.length != 0) {
              DOM.removeChild.value.call(this.viewport, viewportChildren[0]);
            }

            // Iterate through the leaf nodes, adding them to the viewport until the
            // height reaches the render limit
            var bottom = top;
            if (node) {
              main: while (true) {
                DOM.appendChild.value.call(this.viewport, node.element);
                if (node.lastMeasured < this.state) {
                  this._measure(node);
                }
                bottom += this._getHeight(node);
                if (bottom >= end) {
                  renderedBottom = bottom;
                  break;
                }
                c = ++nodeIndexStack[nodeIndexStack.length - 1];
                while (c == node.parent.children.length) {
                  nodeIndexStack.pop();
                  node = node.parent;
                  if (!node.parent) break main;
                  c = ++nodeIndexStack[nodeIndexStack.length - 1];
                }
                node = node.parent.children[c];
                while (node.children) {
                  node = node.children[0];
                  nodeIndexStack.push(0);
                }
              }
            }

            this.renderedTop = Math.min(renderedTop, start);
            this.renderedBottom = Math.max(renderedBottom, end);
          }
        }

        /**
         * Gets the height of a TreeNode.
         * @param {boolean} calculate=false Calculates the height if true.
         * @return {number} Height of the node in pixels.
         */
      },
      {
        key: "_getHeight",
        value: function _getHeight(treeNode) {
          var calculate =
            arguments.length > 1 && arguments[1] !== undefined
              ? arguments[1]
              : false;

          if (calculate) this._measure(treeNode);
          return treeNode.height;
        }

        /**
         * Gets the width of a TreeNode.
         * @param {boolean} calculate=false Calculates the width if true.
         * @return {number} Width of the node in pixels.
         */
      },
      {
        key: "_getWidth",
        value: function _getWidth(treeNode) {
          var calculate =
            arguments.length > 1 && arguments[1] !== undefined
              ? arguments[1]
              : false;

          if (calculate) this._measure(treeNode);
          return treeNode.width;
        }

        /**
         * Measures and saves the dimensions of a TreeNode.
         * @param {TreeNode} treeNode The TreeNode to measure.
         */
      },
      {
        key: "_measure",
        value: function _measure(treeNode) {
          if (treeNode.lastMeasured == this.state) return;
          if (treeNode.children) this._measureBranchNode(treeNode);
          else this._measureLeafNode(treeNode);
        }

        // Updates dimensions of a node based on the dimensions of its children
      },
      {
        key: "_measureBranchNode",
        value: function _measureBranchNode(node) {
          var width = 0,
            height = 0,
            domChildren = 0,
            domChildNodes = 0,
            lastMeasured = -1;
          node.children.forEach(function(child) {
            domChildren += child.domChildren;
            domChildNodes += child.domChildNodes;
            height += child.height;
            if (child.width > width) {
              width = child.width;
            }
            if (lastMeasured < 0 || child.lastMeasured < lastMeasured) {
              lastMeasured = child.lastMeasured;
            }
          });
          node.width = width;
          node.height = height;
          node.domChildren = domChildren;
          node.domChildNodes = domChildNodes;
          node.lastMeasured = lastMeasured < 0 ? 0 : lastMeasured;
        }

        // Measures the dimensions of leaf nodes
      },
      {
        key: "_measureLeafNode",
        value: function _measureLeafNode(node) {
          var noParent = !DOM.parentNode.get.call(node.element);
          if (noParent) DOM.appendChild.value.call(this.viewport, node.element);
          var element = DOM.firstChild.get.call(node.element);
          if (element.nodeType != 1) element = node.element;

          /*
           * Margins are not included in the height, but they do affect the size of
           * the element. The margin height is also calculated seperately because they
           * can collapse when the element before them also has a margin. For example,
           * if an element has a margin of 15px on the bottom and the next element has
           * a margin of 20px on the top, the margins will overlap, leaving 20px of
           * space between them.
           */
          var style = getComputedStyle(element),
            marginWidth =
              parseInt(style.marginLeft) + parseInt(style.marginRight);
          node.marginTop = parseInt(style.marginTop);
          node.marginBottom = parseInt(style.marginBottom);
          var marginHeight = this._calculateMargin(node);

          var box = node.element.getBoundingClientRect(),
            width = box.width + marginWidth,
            height = box.height + marginHeight;
          if (width != node.width) this._setWidth(node, width);

          if (noParent) DOM.removeChild.value.call(this.viewport, node.element);

          // Update dimensions of this and parent nodes
          node.lastMeasured = this.state;
          node.width = width;
          var deltaHeight = height - node.height;
          if (deltaHeight != 0) {
            while (node) {
              node.height += deltaHeight;
              node = node.parent;
            }

            // Update scroll size
            this.scroller.style.height = this.rootNode.height + "px";
          }
        }

        // Finds the size of the margin above the element and adds it to the height
      },
      {
        key: "_calculateMargin",
        value: function _calculateMargin(leaf) {
          // Find the margin of the previous leaf to calculate the margin intersection
          var node = leaf,
            previousLeafMargin = 0;
          while (node.parent) {
            if (node.parent.children[0] != node) {
              node =
                node.parent.children[node.parent.children.indexOf(node) - 1];
              while (node.children) {
                node = node.children[node.children.length - 1];
              }
              previousLeafMargin = node.marginBottom;
              break;
            }
            node = node.parent;
          }

          // TODO: Add the height of the bottom margin if it is the last node...

          // Return the margin size
          var margin = Math.max(leaf.marginTop, previousLeafMargin);
          if (leaf == this.lastLeaf) {
            margin += leaf.marginBottom;
          }
          return margin;
        }

        // Calculates the width of a node by finding the maximum width of its children
      },
      {
        key: "_calculateWidth",
        value: function _calculateWidth(node) {
          var _this4 = this;

          var maxWidth = 0;
          node.children.forEach(function(child) {
            var width = _this4._getWidth(child);
            if (width > maxWidth) maxWidth = width;
          });
          node.width = maxWidth;
        }

        /**
         * Sets the width of a node.
         */
      },
      {
        key: "_setWidth",
        value: function _setWidth(node, width) {
          var oldWidth = node.width;
          if (width != oldWidth) {
            node.width = width;
            while ((node = node.parent)) {
              if (width > node.width) {
                node.width = width;
              } else if (node.width == oldWidth) {
                this._calculateWidth(node);
              } else break;
            }
            if (!node) {
              // TODO: This. (Maybe make a new element to push the inside of the source
              // element and make it overflow? And just let the content visibly overflow
              // the side of the scrollbar?)
              //this.scroller.style.width = width + 'px';
            }
          }
        }

        /**
         * Checks if an element is a block level element.
         * @param {Node} element The DOM node to check for blockiness.
         * @param {Node} elementToAdd The element (if not already on the DOM) to add to
         *     the scroller before checking the computed styles of element.
         * @return {boolean} True if element is a block level element.
         */
      },
      {
        key: "_isBlockElement",
        value: function _isBlockElement(element, elementToAdd) {
          if (element.nodeType != 1) return false;
          if (elementToAdd)
            DOM.appendChild.value.call(this.scroller, elementToAdd);
          var style = getComputedStyle(element),
            isBlock = style.display == "block";
          if (elementToAdd)
            DOM.removeChild.value.call(this.scroller, elementToAdd);
          return isBlock;
        }

        /**
         * Starts a background worker which updates the heights of nodes with currently
         * unknown heights.
         * TODO: Implement a better queue data structure...
         */
      },
      {
        key: "_startUpdateWorker",
        value: function _startUpdateWorker() {
          var _this5 = this;

          var doSomeUpdates = function doSomeUpdates() {
            var endTime = Date.now() + _this5.backgroundUpdateTime;
            while (Date.now() < endTime) {
              var node = _this5.updateQueue.shift();
              _this5._measure(node);
              if (_this5.updateQueue.length == 0) {
                _this5.updating = false;
                return;
              }
            }
            setTimeout(doSomeUpdates, 10);
          };
          doSomeUpdates();
        }

        /**
         * Adds a tree node to the update queue.
         * @param {TreeNode} node Node that needs updating.
         */
      },
      {
        key: "_addToUpdateQueue",
        value: function _addToUpdateQueue(node) {
          this.updateQueue.push(node);
          if (!this.updating) {
            this.updating = true;
            this._scheduleUpdate("startUpdateWorker");
          }
        }

        // Schedules an update of some kind to happen after the execution cycle
      },
      {
        key: "_scheduleUpdate",
        value: function _scheduleUpdate(updateFunctionName) {
          var _this6 = this;

          if (!this.scheduledUpdates) {
            this.scheduledUpdates = [updateFunctionName];
            setTimeout(function() {
              _this6.scheduledUpdates.forEach(function(update) {
                return _this6["_" + update]();
              });
              _this6.scheduledUpdates = null;
            }, 0);
          } else if (this.scheduledUpdates.indexOf(updateFunctionName) < 0) {
            this.scheduledUpdates.push(updateFunctionName);
          }
        }
      }
    ]);
    return SwiftScroll;
  })();

  /*
   * B-tree node constructor
   * Creates B-tree root, branch and leaf nodes.
   * Non-leaf nodes contain a list of other TreeNodes as the "children".
   * The children of leaf nodes are a single block of DOM elements.
   * If this is a leaf node and the elements within this node have not been
   * divided into block elements then set "unparsed" to true. This will cause the
   * elements to be moved out of this node as the individual elements are needed.
   *
   * NOTE: This constructor does NOT add the node to its parent's children array.
   *       Make sure you do that yourself straight after creating the node.
   */

  var TreeNode = function TreeNode(ss, parent, children) {
    classCallCheck(this, TreeNode);

    this.ss = ss;
    this.parent = parent;
    this.width = 0;
    this.height = 0;
    this.lastMeasured = 0;
    this.index = 0;
    this.domChildren = 0;
    this.domChildNodes = 0;

    if (children) {
      // Branch node (check if node.children is truthy to tell)
      this.children = children;
    } else {
      // Leaf node
      this.element = document.createElement("div");
      this.element._swiftScrollLeaf = this;
    }
  };

  return SwiftScroll;
});
//# sourceMappingURL=swift-scroll.js.map
