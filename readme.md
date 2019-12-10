# SwiftScroll

> **WARNING:** Old unfinished project. Use at own risk.

_Renders large amounts of HTML without lag._

## Demo

https://jakzo.github.io/swift-scroll/demo/

## Usage

Blah.

## Performance Tips

- If you apply the CSS style `transform: translateZ(0)` to the container, it
  will render faster when scrolling in most browsers because it is painted on a
  separate layer to the rest of the page. Usually a repaint of the container
  occurs at every instant the container is scrolled, but by using this, repaints
  will only occur when more content is being scrolled into view. If you use all
  vendor prefixes, this will work on every browser targeted by SwiftScroll.
