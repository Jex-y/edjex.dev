+++
title = "Cisco Internship Summer 2022"
date = "2022-09-08T20:29:35+01:00"
author = "Ed Jex"
authorTwitter = "Jex_y" #do not include @
cover = "postImages/cisco-internship/logo.jpeg"
tags = ["Cisco", "Internship", "Webex", "React", "TypeScript"]
keywords = ["Cisco", "Internship", "Ed Jex", "React", "Webex"]
description = ""
showFullContent = false
readingTime = true
hideComments = false
+++

# Cisco Internship Summer 2022

From July to September I worked as a software engineering intern at [Cisco](https://www.cisco.com). I worked on the web app team developing [web.webex.com](https://web.webex.com).

## Background

[Webex by cisco](https://www.webex.com/) is a team messaging / conference calling service. It has a number of client applications including the desktop 'thick client', mobile apps, [hardware endpoints](https://www.cisco.com/c/en_uk/products/collaboration-endpoints/index.html), and the web client on which I worked.

## Technologies

The web app is build with [React](https://reactjs.org) and [Redux](https://redux.js.org) in [Typescript](https://www.typescriptlang.org). Before this I had some limited experience with Typescript although I had used JavaScript for previous projects. I had never encountered React or Redux before so my first step was to learn these through a series of courses. During this I made a demo React website to practice the concepts.

## My Work

I worked on several smaller projects over the course of my internship.

### New Momentum components

Cisco uses the [Momentum Design System](https://momentum.design/). This is a UX spec which we implement in React in [Momentum React v2 library](https://github.com/momentum-design/momentum-react-v2).

The library contains a number of legacy components that we are in the process of migrating to modern ones. Legacy components use JavaScript instead of TypeScript and use class based components instead of functional ones.

The first task I was assigned to was swapping out the legacy checkbox component in the web app with the modern implementation. This was a great introductory exercise as it allowed me to get familiar with the technologies we used and different parts of the codebase.

After this I worked on a new radio group component in momentum. For this I had to learn how to use [storybook](https://storybook.js.org/) for the documentation.

| Legacy Component                                                              | My Implementation                                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ![Legacy Checkbox](/blog/postImages/cisco-internship/radio-button-legacy.png) | ![My Checkbox](/blog/postImages/cisco-internship/radio-button-modern.png) |

The legacy component implemented a radio button whereas I implemented a radio group. This helps to keep the downstream usage of the component closer to the spec and give it better accessability.

I then updated the web app to use this new component in several places. This is where I discovered issues with [adaptive cards](https://adaptivecards.io/) in dark mode. I implemented some quick fixes for this particular case as seen below.

| Using Legacy Component                                                                                             | Using My Component                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| ![Legacy Usage In Space Notifications Settings](/blog/postImages/cisco-internship/radio-button-legacy-usage-1.png) | ![Modern Usage In Space Notifications Settings](/blog/postImages/cisco-internship/radio-button-modern-usage-1.png) |
| ![Legacy Usage In Adaptive Cards](/blog/postImages/cisco-internship/radio-button-legacy-usage-2.png)               | ![Modern Usage In Adaptive Cards](/blog/postImages/cisco-internship/radio-button-modern-usage-2.png)               |

### Fixing Adaptive Card styling

The way that we were implementing adaptive cards was using the provided [Microsoft library](https://learn.microsoft.com/en-gb/adaptive-cards/sdk/rendering-cards/javascript/getting-started) and passing some of our own components to it. Our components were responsive to the app's theme but the cards were not as they had hardcoded colour values. This resulted in the cards containing white text on a white background. There were also some issues with our components not integrating correctly.

This can best be seen when using input components as they were all custom.

I explored using my own implementation for this, however I found that I could fix the usage of the Microsoft library by passing in CSS variables as the colours. THis means that the colours of the card would match the theme along with the rest of the app. Other than this, I had to replace some of the input components and style some of the built in ones.

| Broken Adaptive Cards                                                               | Fixed Adaptive Cards                                                              |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| ![Broken Adaptive Card](/blog/postImages/cisco-internship/adaptive-card-broken.png) | ![Fixed Adaptive Card](/blog/postImages/cisco-internship/adaptive-card-fixed.png) |

### Improving end-to-end testing with visual regression testing

To make sure that a bug like this doesn't happen again I implemented visual regression testing. Normal unit tests and end-to-end tests only rely on the structure and functionality of the page and ignore the styling. Since we were already using [Playwright](https://playwright.dev/) for end-to-end test this was not too difficult. I configured playwright to run these tests and any others tagged in all available themes. This is not important for most tests as they should just be using the CSS variables we set for the theme.

I tested our implementation over a number of example of adaptive cards. Some of the screenshots produced by the tests can be seen below:

| Name           | Light Theme                                                                                            | Dark Theme                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Flight Details | ![Flight Details Light](/blog/postImages/cisco-internship/flightDetails-Chrome-light-theme--linux.png) | ![Flight Details Dark](/blog/postImages/cisco-internship/flightDetails-Chrome-dark-theme--linux.png) |
| Food Order     | ![Food Order Light](/blog/postImages/cisco-internship/foodOrder-Chrome-light-theme--linux.png)         | ![Food Order Dark](/blog/postImages/cisco-internship/foodOrder-Chrome-dark-theme--linux.png)         |
| Image Gallery  | ![Image Gallery Light](/blog/postImages/cisco-internship/imageGallery-Chrome-light-theme--linux.png)   | ![Image Gallery Dark](/blog/postImages/cisco-internship/imageGallery-Chrome-dark-theme--linux.png)   |
| Stock Update   | ![Stock Update Light](/blog/postImages/cisco-internship/stockUpdate-Chrome-light-theme--linux.png)     | ![Stock Update Dark](/blog/postImages/cisco-internship/stockUpdate-Chrome-dark-theme--linux.png)     |

Carrying on from this, I added visual regression tests for some of the commonly visited pages of the application and the meeting join flow. Some examples of this are shown below.

| Name              | Screenshot                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Messaging Page    | ![Messaging Page](/blog/postImages/cisco-internship/messaging-page-main-Chrome-dark-theme--linux.png)    |
| Calling Toast     | ![Calling Toast](/blog/postImages/cisco-internship/meeting-toast-Chrome-dark-theme--linux.png)           |
| Interstitial Page | ![Interstitial Page](/blog/postImages/cisco-internship/interstitial-screen-Chrome-dark-theme--linux.png) |

### Optimising test pipeline and developer experience

As I was implementing more end-to-end tests, I had to keep running our testing pipeline. This was taking about 25 mins per run. A breakdown of which steps were taking the longest can be seen below.

![Pipeline Stages](/blog/postImages/cisco-internship/pipeline-stages.png)

I tried to improve the unit test speed by upgrading jest from v26 to v28 but found that there were a lot of issues with the fake timers. The next longest step was the build.

We currently use [webpack](https://webpack.js.org/) which is written in JS. As this is a sizable project the development server start currently takes 3 mins. I investigated using [Vite](https://vitejs.dev/) which is usually quite a lot faster. This uses [Rollup](https://rollupjs.org/guide/en/) underneath which is written in JavaScript so is still not very fast. Building with vite took 1 min 50 sec so an improvement but not large enough to make it worthwhile.

[ESBuild](https://esbuild.github.io/) is written in Go and is significantly faster. My experimental branch builds in just under 4 seconds. This is a great improvement and hopefully will be able to increase developer productivity in the future. I got this working on the second to last day of my internship and it still has some issues (icons not being loaded, wrong components being animated).

![Build Times](/blog/postImages/cisco-internship/build-times.png)

## Conclusion

I have had a great time working at Cisco and have learned so much about software development in a large team. One of the best parts was being able to see my code deployed in production.

I would like to thank the whole web app team for all being so helpful and approachable, especially my mentor [Christoph Scheffauer](https://www.linkedin.com/in/christoph-scheffauer) for answering all of my questions.
