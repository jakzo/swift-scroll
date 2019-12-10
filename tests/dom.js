
// Node

new Test('DOM Abstraction', 'childNodes', function () {
  if (!Node.prototype.hasOwnProperty('childNodes')) return;
  var stage = Util.setup(100);

  assert(stage.container.childNodes.length == 100, 'container.childNodes.length != 100');
  var lastLeaf = stage.ss.rootNode;
  while (lastLeaf.children) lastLeaf = lastLeaf.children[lastLeaf.children.length - 1];
  assert(stage.container.childNodes[99] == DOM.firstChild.get.call(lastLeaf.element), 'container.childNodes[99] != lastLeaf.element.firstChild');

  var childChildNode = document.createElement('div');
  stage.container.childNodes[0].appendChild(childChildNode);
  assert(stage.container.childNodes.length == 100, 'container.childNodes.length != 100 after appending to child');
  assert(stage.container.childNodes[0].childNodes.length == 2, 'container.childNodes[0].childNodes.length != 2 after appending to child');
  assert(stage.container.childNodes[0].childNodes[1] == childChildNode, 'container.childNodes[0].childNodes[1] != childChildNode after appending to child');

  var testAreaChildNode = document.createElement('div');
  stage.testArea.append(testAreaChildNode);
  assert(stage.testArea.childNodes.length == 2, 'testArea.length != 2 after append');
  assert(stage.testArea.childNodes[1] == testAreaChildNode, 'testArea.childNodes[1] != element');

  var before = stage.container.childNodes;
  stage.container.childNodes = 4;
  assert(stage.container.childNodes == before, 'childNodes not read only');
});

new Test('DOM Abstraction', 'firstChild', function () {
  if (!Node.prototype.hasOwnProperty('firstChild')) return;
  var stage = Util.setup(100);

  var firstLeaf = stage.ss.rootNode;
  while (firstLeaf.children) firstLeaf = firstLeaf.children[0];
  var firstChild = DOM.firstChild.get.call(firstLeaf.element);
  assert(stage.container.firstChild == firstChild, 'container.firstChild != firstLeaf.element.firstChild');

  var childChildNode = document.createTextNode('test');
  DOM.insertBefore.value.call(firstChild, childChildNode, DOM.firstChild.get.call(firstChild));
  assert(firstChild.firstChild == childChildNode, 'child.firstChild != inserted node');

  assert(stage.testArea.firstChild == stage.container, 'testArea.firstChild != container');

  var before = stage.container.firstChild;
  stage.container.firstChild = 4;
  assert(stage.container.firstChild == before, 'firstChild not read only');
});

new Test('DOM Abstraction', 'lastChild', function () {
  if (!Node.prototype.hasOwnProperty('lastChild')) return;
  var stage = Util.setup(100);

  var lastLeaf = stage.ss.rootNode;
  while (lastLeaf.children) lastLeaf = lastLeaf.children[lastLeaf.children.length - 1];
  var lastChild = DOM.lastChild.get.call(lastLeaf.element);
  assert(stage.container.childNodes[stage.container.childNodes.length - 1] == lastChild, 'container.lastChild != lastChild');

  var childChildNode = document.createTextNode('test');
  lastChild.appendChild(childChildNode);
  assert(lastChild.lastChild == childChildNode, 'child.lastChild != inserted node');

  DOM.insertBefore.value.call(stage.testArea, childChildNode, stage.container);
  assert(stage.testArea.lastChild == stage.container, 'testArea.lastChild != container');

  var before = stage.container.lastChild;
  stage.container.lastChild = 4;
  assert(stage.container.lastChild == before, 'lastChild not read only');
});

new Test('DOM Abstraction', 'nextSibling', function () {
  if (!Node.prototype.hasOwnProperty('nextSibling')) return;
  var stage = Util.setup(100);

  var child = stage.ss.dom.childNodes[90];
  assert(child.nextSibling == stage.ss.dom.childNodes[91], 'child.nextSibling != nextSibling');
  assert(stage.ss.dom.childNodes[99].nextSibling == null, 'lastChild.nextSibling == something');

  var node = document.createTextNode('test');
  stage.testArea.appendChild(node);
  assert(stage.container.nextSibling == node, 'container.nextSibling != inserted node');

  child.appendChild(node);
  assert(child.firstChild.nextSibling == node, 'descendant.nextSibling != nextSibling');

  var before = child.nextSibling;
  child.nextSibling = 4;
  assert(child.nextSibling == before, 'child.nextSibling not read only');
});

new Test('DOM Abstraction', 'parentNode', function () {
  if (!Node.prototype.hasOwnProperty('parentNode')) return;
  var stage = Util.setup(100);

  var child = stage.ss.dom.childNodes[90];
  assert(child.parentNode == stage.container, 'child.parentNode != container');

  assert(stage.container.parentNode == stage.testArea, 'container.parentNode != parent');
  assert(DOM.firstChild.get.call(child).parentNode == child, 'descendant.parentNode != child');

  var node = document.createTextNode('test');
  stage.testArea.appendChild(node);
  assert(node.parentNode == stage.testArea, 'outside.parentNode != parent');

  var before = child.parentNode;
  child.parentNode = 4;
  assert(child.parentNode == before, 'child.parentNode not read only');
});

new Test('DOM Abstraction', 'parentElement', function () {
  if (!Node.prototype.hasOwnProperty('parentElement')) return;
  var stage = Util.setup(100);

  var child = stage.ss.dom.childNodes[90];
  assert(child.parentElement == stage.container, 'child.parentElement != container');

  assert(stage.container.parentElement == stage.testArea, 'container.parentElement != parent');
  assert(DOM.firstChild.get.call(child).parentElement == child, 'descendant.parentElement != child');

  var node = document.createTextNode('test');
  stage.testArea.appendChild(node);
  assert(node.parentElement == stage.testArea, 'outside.parentElement != parent');

  var before = child.parentElement;
  child.parentElement = 4;
  assert(child.parentElement == before, 'child.parentElement not read only');
});

new Test('DOM Abstraction', 'previousSibling', function () {
  if (!Node.prototype.hasOwnProperty('previousSibling')) return;
  var stage = Util.setup(100);

  var child = stage.ss.dom.childNodes[90];
  assert(child.previousSibling == stage.ss.dom.childNodes[89], 'child.previousSibling != previousSibling');
  assert(stage.ss.dom.childNodes[0].previousSibling === null, 'firstChild.previousSibling == something');

  var node = document.createTextNode('test');
  stage.testArea.insertBefore(node, stage.container);
  assert(stage.container.previousSibling == node, 'container.previousSibling != inserted node');

  child.insertBefore(node, child.lastChild);
  assert(child.lastChild.previousSibling == node, 'descendant.previousSibling != previousSibling');

  var before = child.previousSibling;
  child.previousSibling = 4;
  assert(child.previousSibling == before, 'child.previousSibling not read only');
});

new Test('DOM Abstraction', 'textContent', function () {
  if (!Node.prototype.hasOwnProperty('textContent')) return;
  var stage = Util.setup(100);

  // Getter
  var containerText = [];
  for (var i = 0; i < 100; i++) containerText.push(Util.sampleText);
  containerText = containerText.join('');
  assert(stage.container.textContent == containerText, 'container.textContent != sampleText * 100');

  var child = stage.ss.dom.childNodes[90];
  assert(child.textContent == Util.sampleText, 'child.textContent != sampleText');

  var node = document.createTextNode('test');
  stage.testArea.insertBefore(node, stage.container);
  assert(node.textContent == 'test', 'node.textContent != node text');
  assert(stage.testArea.textContent == 'test' + containerText, 'testArea.textContent != text');

  // Setter
  var testText = 'asdf\nzxcv';
  child.textContent = testText;
  assert(child.textContent == testText, 'child.textContent != set text');
  stage.container.textContent = testText;
  assert(stage.container.textContent == testText, 'container.textContent != set text');
  assert(stage.ss.dom.childNodes.length == 1, 'container.childNodes != 1');
  stage.testArea.textContent = testText;
  assert(stage.testArea.textContent == testText, 'testArea.textContent != set text');
});

new Test('DOM Abstraction', 'rootNode', function () {
  if (!Node.prototype.hasOwnProperty('rootNode')) return;
  // TODO: This when I do .getRootNode()...
});
