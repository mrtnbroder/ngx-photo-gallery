import { Directive, Output, EventEmitter } from '@angular/core'
import * as PhotoSwipe from 'photoswipe'
import * as PhotoSwipeUI_Default from 'photoswipe/dist/photoswipe-ui-default'
import { LightboxService } from './lightbox/lightbox.service'
import { element } from '@angular/core/src/render3'

export interface GalleryImage {
  id: string
  src: string
  w: number
  h: number
  doGetSlideDimensions?: boolean
}

export interface GalleryItem {
  id: string
  element: HTMLElement
  image: GalleryImage
}

@Directive({
  selector: '[photoGalleryGroup]',
})
export class PhotoGalleryGroupDirective {
  gallery: PhotoSwipe
  galleryItems: { [key: string]: GalleryItem } = {}
  galleryItemIds: Set<string> = new Set<string>()
  galleryImages: GalleryImage[] = []
  @Output() onPhotoGalleryInit = new EventEmitter()
  @Output() onPhotoGalleryDestroy = new EventEmitter()

  constructor(private lightboxService: LightboxService) {}

  registerGalleryItem(item: { id: string; element: HTMLElement; imageUrl: string }) {
    const image = {
      id: item.id,
      src: item.imageUrl,
      w: 0,
      h: 0,
      doGetSlideDimensions: true,
    }
    this.galleryItems[item.id] = {
      id: item.id,
      element: item.element,
      image,
    }

    this.galleryItemIds.add(item.id)
  }

  unregisterGalleryItem(id: string) {
    this.galleryItemIds.delete(id)
  }

  async openPhotoSwipe(id: string) {
    if (this.galleryItems[id].image.doGetSlideDimensions) {
      const targetImage = await loadImage(this.galleryItems[id].image.src)
      this.galleryItems[id].image.w = targetImage.naturalWidth
      this.galleryItems[id].image.h = targetImage.naturalHeight
      delete this.galleryItems[id].image.doGetSlideDimensions
    }

    this.galleryImages = [...this.galleryItemIds].map(key => this.galleryItems[key].image)
    const idx = this.galleryImages.findIndex(image => image.id === id)
    const options: PhotoSwipe.Options = {
      index: idx,
      history: false,
      closeEl: true,
      captionEl: false,
      fullscreenEl: false,
      zoomEl: true,
      shareEl: false,
      counterEl: true,
      arrowEl: false,
      preloaderEl: true,

      getThumbBoundsFn: (idx: number) => {
        const key = this.galleryImages[idx].id
        const thumbnail = this.galleryItems[key].element
        const pageYScroll = window.pageYOffset || document.documentElement.scrollTop
        const rect = thumbnail.getBoundingClientRect()

        return { x: rect.left, y: rect.top + pageYScroll, w: rect.width }
      },
    }
    const photoSwipe = this.lightboxService.getLightboxElement()

    this.gallery = new PhotoSwipe(photoSwipe, PhotoSwipeUI_Default, this.galleryImages, options)
    this.gallery.listen('gettingData', (idx, slide) => {
      if (slide.doGetSlideDimensions) {
        setTimeout(() => {
          this.getSlideDimensions(slide)
        }, 300)
      }
    })
    this.gallery.listen('imageLoadComplete', (idx, slide) => {
      if (slide.doGetSlideDimensions) {
        this.getSlideDimensions(slide)
      }
    })
    this.gallery.listen('destroy', () => {
      this.onPhotoGalleryDestroy.emit()
    })
    this.onPhotoGalleryInit.emit()
    this.gallery.init()
  }

  async getSlideDimensions(slide: any) {
    if (!slide.doGetSlideDimensions) {
      return
    }

    const image = await loadImage(slide.src).catch(() => null)

    slide.doGetSlideDimensions = false

    slide.w = image.naturalWidth
    slide.h = image.naturalHeight

    this.gallery.invalidateCurrItems()
    this.gallery.updateSize(true)
  }
}

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = e => reject(e)
    image.src = path
  })
}
