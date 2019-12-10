import { DOM, checkContainerVisibility } from "./dom-abstraction";
import Util from "./util";

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
class SwiftScroll {
  constructor({
    container = document.createElement("div"),
    nodeMaxChildren = 20,
    viewportBufferSize = 2000,
    backgroundUpdateTime = 20
  }) {
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

    // TODO: Call this when the container is removed or added to the tree using DOM
    //       manipulation events...
    checkContainerVisibility(this.container);

    // Put the DOM nodes already in the source element into the B-tree
    // TODO: See which one transpiles more efficiently...
    // const childNodes = Array.prototype.slice.call(this.container.childNodes);
    const childNodes = [...this.container.childNodes];
    DOM.appendChild.value.call(this.container, this.scroller);
    childNodes.forEach(node => {
      DOM.removeChild.value.call(this.container, node);
      this.append(node);
    });

    // Register events
    this.container.addEventListener(
      "scroll",
      e => {
        this._updateViewportPosition();
      },
      false
    );
    Util.listenForResize(this.container, (width, height) => {
      this.state++;
      this._updateViewportDimensions();
    });

    this._updateViewportDimensions();
  }

  /**
   * Adds a DOM node at the end of all the elements.
   * @param {Node} domNode DOM node to insert.
   */
  append(domNode) {
    let results = this._findLastLeaf();
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
  insertAt(domNode, index) {
    if (index < 0) index = 0;
    const results = this._findLeaf("domChildNodes", index);
    if (results) {
      this._insertNodeInLeaf(results, index - results.domChildNodes, domNode);
    } else {
      this.append(domNode);
    }
  }

  clear() {
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
  _insertNodeInLeaf(results, index, domNode) {
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
  _leafDomUpdated(results) {
    // Count the number of DOM elements and nodes in this node
    // TODO: Spread...?
    let elementChildNodes = DOM.childNodes.get.call(results.node.element),
      elementChildren = DOM.children.get.call(results.node.element);
    const childNodes = Array.prototype.slice.call(elementChildNodes),
      children = Array.prototype.slice.call(elementChildren),
      addedChildNodes = childNodes.length - results.node.domChildNodes,
      addedChildren = children.length - results.node.domChildren,
      childNodesChanged =
        addedChildNodes != 0 ||
        childNodes.some((node, i) => {
          return node != this.dom.childNodes[results.domChildNodes + i];
        }),
      childrenChanged =
        addedChildren != 0 ||
        children.some((node, i) => {
          return node != this.dom.children[results.domChildren + i];
        });

    // Update the source element child lists
    if (childNodesChanged) {
      this.dom.childNodes.splice(
        results.domChildNodes,
        results.node.domChildNodes,
        ...childNodes
      );
    }
    if (childrenChanged) {
      this.dom.children.splice(
        results.domChildren,
        results.node.domChildren,
        ...children
      );
    }

    // Add the number of added DOM nodes to this leaf and its ancestors
    if (childNodesChanged || childrenChanged) {
      let node = results.node;
      while (node) {
        node.domChildNodes += addedChildNodes;
        node.domChildren += addedChildren;
        node = node.parent;
      }
    }

    // Check if a block element has changed to inline or vice-versa
    let node = results.node,
      i = 0;
    this._addToUpdateQueue(node);
    while (i < elementChildNodes.length) {
      const child = elementChildNodes[i],
        isBlock = this._isBlockElement(child, node.element);

      // Split the leaf node if it contains incompatible elements
      if (i > 0) {
        if (isBlock || node.isBlock) {
          // Create the new leaf node
          const newNode = new TreeNode(this, node.parent);
          node.parent.children.splice(results.childIndex + 1, 0, newNode);
          newNode.isBlock = isBlock;
          // Add the elements to the new node
          while (elementChildNodes.length > i) {
            const domNode = elementChildNodes[i];
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
  _splitNode(node) {
    while (node.children.length > this.nodeMaxChildren) {
      // If the root node needs to be split, create a new root node to be parent
      if (node == this.rootNode) {
        this.rootNode = new TreeNode(this, null, [node]);
        node.parent = this.rootNode;
        this._measure(this.rootNode);
      }

      // Split the node
      const half = (node.children.length / 2) | 0,
        children = node.children.slice(half),
        newNode = new TreeNode(this, node.parent, children),
        index = node.parent.children.indexOf(node) + 1;
      node.parent.children.splice(index, 0, newNode);
      children.forEach(child => (child.parent = newNode));
      node.children = node.children.slice(0, half);
      this._measure(node);
      this._measure(newNode);

      node = node.parent;
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
  _findLeaf(property, value) {
    const results = {
      node: this.rootNode,
      childIndex: -1,
      index: 0,
      domChildNodes: 0,
      domChildren: 0,
      height: 0
    };
    let sum = 0;
    while (
      (results.node = results.node.parent.children[++results.childIndex])
    ) {
      const size = results.node[property];
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
  _findLastLeaf() {
    if (this.rootNode.children.length == 0) return null;
    let node = this.rootNode,
      parent;
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
  _siblingLeaf(leaf, before = false) {
    let siblings = leaf.parent.children;
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
  _updateViewportDimensions() {
    const width = DOM.clientWidth.get.call(this.container),
      height = DOM.clientHeight.get.call(this.container);
    if (width != this.viewportWidth || height != this.viewportHeight) {
      this.viewportWidth = width;
      this.viewportHeight = height;
      this._forceUpdateViewportPosition();
    }
  }

  // Removes all visible elements then redraws the viewport
  _forceUpdateViewportPosition() {
    const children = DOM.childNodes.get.call(this.viewport);
    while (children.length != 0) {
      DOM.removeChild.value.call(this.viewport, children[0]);
    }
    this.renderedTop = this.renderedBottom = -Infinity;
    this._updateViewportPosition();
  }

  // Checks if the currently visible elements need to be changed
  _updateViewportPosition() {
    const viewportHeight = this.viewportHeight,
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
      const start = viewportTop - bufferSize * 2,
        end = viewportTop + viewportHeight + bufferSize * 2,
        nodeIndexStack = [];
      let children = this.rootNode.children,
        top = 0,
        c = 0,
        renderedTop = 0,
        renderedBottom = 0,
        node;
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
      const viewportChildren = DOM.childNodes.get.call(this.viewport);
      while (viewportChildren.length != 0) {
        DOM.removeChild.value.call(this.viewport, viewportChildren[0]);
      }

      // Iterate through the leaf nodes, adding them to the viewport until the
      // height reaches the render limit
      let bottom = top;
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
  _getHeight(treeNode, calculate = false) {
    if (calculate) this._measure(treeNode);
    return treeNode.height;
  }

  /**
   * Gets the width of a TreeNode.
   * @param {boolean} calculate=false Calculates the width if true.
   * @return {number} Width of the node in pixels.
   */
  _getWidth(treeNode, calculate = false) {
    if (calculate) this._measure(treeNode);
    return treeNode.width;
  }

  /**
   * Measures and saves the dimensions of a TreeNode.
   * @param {TreeNode} treeNode The TreeNode to measure.
   */
  _measure(treeNode) {
    if (treeNode.lastMeasured == this.state) return;
    if (treeNode.children) this._measureBranchNode(treeNode);
    else this._measureLeafNode(treeNode);
  }

  // Updates dimensions of a node based on the dimensions of its children
  _measureBranchNode(node) {
    let width = 0,
      height = 0,
      domChildren = 0,
      domChildNodes = 0,
      lastMeasured = -1;
    node.children.forEach(child => {
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
  _measureLeafNode(node) {
    const noParent = !DOM.parentNode.get.call(node.element);
    if (noParent) DOM.appendChild.value.call(this.viewport, node.element);
    let element = DOM.firstChild.get.call(node.element);
    if (element.nodeType != 1) element = node.element;

    /*
     * Margins are not included in the height, but they do affect the size of
     * the element. The margin height is also calculated seperately because they
     * can collapse when the element before them also has a margin. For example,
     * if an element has a margin of 15px on the bottom and the next element has
     * a margin of 20px on the top, the margins will overlap, leaving 20px of
     * space between them.
     */
    const style = getComputedStyle(element),
      marginWidth = parseInt(style.marginLeft) + parseInt(style.marginRight);
    node.marginTop = parseInt(style.marginTop);
    node.marginBottom = parseInt(style.marginBottom);
    const marginHeight = this._calculateMargin(node);

    const box = node.element.getBoundingClientRect(),
      width = box.width + marginWidth,
      height = box.height + marginHeight;
    if (width != node.width) this._setWidth(node, width);

    if (noParent) DOM.removeChild.value.call(this.viewport, node.element);

    // Update dimensions of this and parent nodes
    node.lastMeasured = this.state;
    node.width = width;
    const deltaHeight = height - node.height;
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
  _calculateMargin(leaf) {
    // Find the margin of the previous leaf to calculate the margin intersection
    let node = leaf,
      previousLeafMargin = 0;
    while (node.parent) {
      if (node.parent.children[0] != node) {
        node = node.parent.children[node.parent.children.indexOf(node) - 1];
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
    let margin = Math.max(leaf.marginTop, previousLeafMargin);
    if (leaf == this.lastLeaf) {
      margin += leaf.marginBottom;
    }
    return margin;
  }

  // Calculates the width of a node by finding the maximum width of its children
  _calculateWidth(node) {
    let maxWidth = 0;
    node.children.forEach(child => {
      const width = this._getWidth(child);
      if (width > maxWidth) maxWidth = width;
    });
    node.width = maxWidth;
  }

  /**
   * Sets the width of a node.
   */
  _setWidth(node, width) {
    const oldWidth = node.width;
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
  _isBlockElement(element, elementToAdd) {
    if (element.nodeType != 1) return false;
    if (elementToAdd) DOM.appendChild.value.call(this.scroller, elementToAdd);
    const style = getComputedStyle(element),
      isBlock = style.display == "block";
    if (elementToAdd) DOM.removeChild.value.call(this.scroller, elementToAdd);
    return isBlock;
  }

  /**
   * Starts a background worker which updates the heights of nodes with currently
   * unknown heights.
   * TODO: Implement a better queue data structure...
   */
  _startUpdateWorker() {
    const doSomeUpdates = () => {
      const endTime = Date.now() + this.backgroundUpdateTime;
      while (Date.now() < endTime) {
        const node = this.updateQueue.shift();
        this._measure(node);
        if (this.updateQueue.length == 0) {
          this.updating = false;
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
  _addToUpdateQueue(node) {
    this.updateQueue.push(node);
    if (!this.updating) {
      this.updating = true;
      this._scheduleUpdate("startUpdateWorker");
    }
  }

  // Schedules an update of some kind to happen after the execution cycle
  _scheduleUpdate(updateFunctionName) {
    if (!this.scheduledUpdates) {
      this.scheduledUpdates = [updateFunctionName];
      setTimeout(() => {
        this.scheduledUpdates.forEach(update => this["_" + update]());
        this.scheduledUpdates = null;
      }, 0);
    } else if (this.scheduledUpdates.indexOf(updateFunctionName) < 0) {
      this.scheduledUpdates.push(updateFunctionName);
    }
  }
}

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
class TreeNode {
  constructor(ss, parent, children) {
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
  }
}

export default SwiftScroll;

window.SwiftScroll = SwiftScroll;
