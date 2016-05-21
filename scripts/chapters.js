(function ($) {

  AblePlayer.prototype.populateChaptersDiv = function() {

    var headingLevel, headingType, headingId, $chaptersHeading,
      $chaptersList;

    if ($('#' + this.chaptersDivLocation)) {
      this.$chaptersDiv = $('#' + this.chaptersDivLocation);
      this.$chaptersDiv.addClass('able-chapters-div');

      // add optional header
      if (this.chaptersTitle) {
        headingLevel = this.getNextHeadingLevel(this.$chaptersDiv);
        headingType = 'h' + headingLevel.toString();
        headingId = this.mediaId + '-chapters-heading';
        $chaptersHeading = $('<' + headingType + '>', {
          'class': 'able-chapters-heading',
          'id': headingId
        }).text(this.chaptersTitle);
        this.$chaptersDiv.append($chaptersHeading);
      }

      this.$chaptersNav = $('<nav>');
      if (this.chaptersTitle) {
        this.$chaptersNav.attr('aria-labelledby',headingId);
      }
      else {
        this.$chaptersNav.attr('aria-label',this.tt.chapters);
      }
      this.$chaptersDiv.append(this.$chaptersNav);

      // populate this.$chaptersNav with a list of chapters
      this.updateChaptersList();
    }
  };

  AblePlayer.prototype.updateChaptersList = function() {

    var thisObj, cues, $chaptersList, c, thisChapter,
      $chapterItem, $chapterButton, buttonId, hasDefault,
      getClickFunction, $clickedItem, $chaptersList, thisChapterIndex;

    thisObj = this;

    if (!this.$chaptersNav) {
      return false;
    }

    if (this.selectedChapters) {
      cues = this.selectedChapters.cues;
    }
    else if (this.chapters.length >= 1) {
      cues = this.chapters[0].cues;
    }
    else {
      cues = [];
    }
    if (cues.length > 0) {
      $chaptersList = $('<ul>');
      for (c in cues) {
        thisChapter = c;
        $chapterItem = $('<li></li>');
        $chapterButton = $('<button>',{
          'type': 'button',
          'val': thisChapter
        }).text(this.flattenCueForCaption(cues[thisChapter]));

        // add event listeners
        getClickFunction = function (time) {
          return function () {
            $clickedItem = $(this).closest('li');
            $chaptersList = $(this).closest('ul').find('li');
            thisChapterIndex = $chaptersList.index($clickedItem);
            $chaptersList.removeClass('able-current-chapter').attr('aria-selected','');
            $clickedItem.addClass('able-current-chapter').attr('aria-selected','true');
            // Don't update this.currentChapter here; just seekTo chapter's start time;
            // chapter will be updated via chapters.js > updateChapter()
            thisObj.seekTo(time);
          }
        };
        $chapterButton.on('click',getClickFunction(cues[thisChapter].start)); // works with Enter too
        $chapterButton.on('focus',function() {
          $(this).closest('ul').find('li').removeClass('able-focus');
          $(this).closest('li').addClass('able-focus');
        });
        $chapterItem.on('hover',function() {
          $(this).closest('ul').find('li').removeClass('able-focus');
          $(this).addClass('able-focus');
        });
        $chapterItem.on('mouseleave',function() {
          $(this).removeClass('able-focus');
        });
        $chapterButton.on('blur',function() {
          $(this).closest('li').removeClass('able-focus');
        });

        // put it all together
        $chapterItem.append($chapterButton);
        $chaptersList.append($chapterItem);
        if (this.defaultChapter == cues[thisChapter].id) {
          $chapterButton.attr('aria-selected','true').parent('li').addClass('able-current-chapter');
          hasDefault = true;
        }
      }
      if (!hasDefault) {
        // select the first button
        $chaptersList.find('button').first().attr('aria-selected','true')
          .parent('li').addClass('able-current-chapter');
      }
      this.$chaptersNav.html($chaptersList);
    }
    return false;
  };

  AblePlayer.prototype.seekToDefaultChapter = function() {
    // this function is only called if this.defaultChapter is not null
    // step through chapters looking for default
    var i=0;
    while (i < this.chapters.length) {
      if (this.chapters[i].id === this.defaultChapter) {
        // found the default chapter! Seek to it
        this.seekTo(this.chapters[i].start);
      }
      i++;
    }
  };

  AblePlayer.prototype.updateChapter = function (now) {

    // as time-synced chapters change during playback, track changes in current chapter

    if (typeof this.chapters === 'undefined') {
      return;
    }

    var chapters, i, thisChapterIndex, chapterLabel;

    chapters = this.chapters;
    for (i in chapters) {
      if ((chapters[i].start <= now) && (chapters[i].end > now)) {
        thisChapterIndex = i;
        break;
      }
    }
    if (typeof thisChapterIndex !== 'undefined') {
      if (this.currentChapter !== chapters[thisChapterIndex]) {
        // this is a new chapter
        this.currentChapter = chapters[thisChapterIndex];
        if (this.useChapterTimes) {
          this.chapterDuration = this.getChapterDuration();
          this.seekIntervalCalculated = false; // will be recalculated in setSeekInterval()
        }
        if (typeof this.$chaptersDiv !== 'undefined') {
          // chapters are listed in an external container
          this.$chaptersDiv.find('ul').find('li').removeClass('able-current-chapter').attr('aria-selected','');
          this.$chaptersDiv.find('ul').find('li').eq(thisChapterIndex)
            .addClass('able-current-chapter').attr('aria-selected','true');
        }
        // announce new chapter via ARIA alert
        chapterLabel = this.tt.newChapter + ': ' + this.flattenCueForCaption(this.currentChapter);
        this.showAlert(chapterLabel,'screenreader');
      }
    }
  };

  AblePlayer.prototype.getChapterDuration = function () {

    // called if this.seekbarScope === 'chapter'
    // get duration of the current chapter

    var videoDuration, lastChapterIndex, chapterEnd;

    if (typeof this.currentChapter === 'undefined') {
      return 0;
    }
    videoDuration = this.getDuration();
    lastChapterIndex = this.chapters.length-1;
    if (this.chapters[lastChapterIndex] == this.currentChapter) {
      // this is the last chapter
      if (this.currentChapter.end !== videoDuration) {
        // chapter ends before or after video ends, adjust chapter end to match video end
        chapterEnd = videoDuration;
        this.currentChapter.end = videoDuration;
      }
      else {
        chapterEnd = this.currentChapter.end;
      }
    }
    else { // this is not the last chapter
      chapterEnd = this.currentChapter.end;
    }
    return chapterEnd - this.currentChapter.start;
  };

  AblePlayer.prototype.getChapterElapsed = function () {

    // called if this.seekbarScope === 'chapter'
    // get current elapsed time, relative to the current chapter duration
    if (typeof this.currentChapter === 'undefined') {
      return 0;
    }
    var videoDuration = this.getDuration();
    var videoElapsed = this.getElapsed();
    if (videoElapsed > this.currentChapter.start) {
      return videoElapsed - this.currentChapter.start;
    }
    else {
      return 0;
    }
  };

  AblePlayer.prototype.convertChapterTimeToVideoTime = function (chapterTime) {

    // chapterTime is the time within the current chapter
    // return the same time, relative to the entire video
    if (typeof this.currentChapter !== 'undefined') {
      var newTime = this.currentChapter.start + chapterTime;
      if (newTime > this.currentChapter.end) {
        return this.currentChapter.end;
      }
      else {
        return newTime;
      }
    }
    else {
      return chapterTime;
    }
  };

})(jQuery);
