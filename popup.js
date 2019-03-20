var pageDonation = 'page-donation'
var pageNoDonate = 'page-nodonate'
var pageBrainblocks = 'page-brainblocks'
var pageHistory = 'page-history'
var pageDonationSuccessful = 'page-donation-successful'
var pageDonationUnsuccessful = 'page-donation-unsuccessful'
var nanoCrawlerAccountURL = 'https://nanocrawler.cc/explorer/account/'
var nanoCrawlerBlockURL = 'https://nanocrawler.cc/explorer/block/'
var validNanoAddress = /^[+-]?((\.\d+)|(\d+(\.\d+)?))$/
var amountValid = false
var raiMultiplier = 1000000

// ---------------------------------------------------

document.addEventListener('DOMContentLoaded', function () {
  var nanoDonationFormElement = $('nano-donation-form')
  var nanoDonationAmountElement = $('nano-donation-amount')
  var nanoAmountErrorElement = $('nano-amount-error')
  var nanoDonationSubmitElement = $('nano-donation-submit')
  var footerLinkNanocharts = $('footer-link-nanocharts')
  var historyLinkElement = $('history-link')
  var historyLinkDonationSuccessfulElement = $('history-link-donation-successful')
  var donationsHistoryElement = $('donations-history')
  var donationSuccessfulDetailsElement = $('donation-successful-details')
  var suggestionElements = document.getElementsByClassName('suggestion')

  var bg = chrome.extension.getBackgroundPage()

  // Query current tab
  chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
    // Get cache entry which associates current URL to Nano address (if any)
    var nanoAddressCacheEntry = bg.nanoAddressCache.get(tabs[0].id)

    var nanoAddress = nanoAddressCacheEntry.nanoAddress
    var url = nanoAddressCacheEntry.url

    // Set event handlers
    nanoDonationAmountElement.onkeyup = nanoDonationAmountChanged
    nanoDonationFormElement.onsubmit = onNanoDonationFormSubmit
    Array.from(suggestionElements).forEach(function (suggestionElement) {
      suggestionElement.onclick = onSuggestionClicked
    })
    historyLinkElement.onclick = historyLinkDonationSuccessfulElement.onclick = onHistoryLinkClicked

    // Check if web page is enabled to accept Nano donations (if Nano address exists in meta tag)
    if (nanoAddress) {
      $('website').innerText = url
      setNanoAddress($('address'))
      nanoDonationFormElement.onsubmit = onNanoDonationFormSubmit
      showPage(pageDonation)
    } else {
      showPage(pageNoDonate)
    }

    // -----

    function onNanoDonationFormSubmit (event) {
      event.preventDefault()
      var nanoDonationAmountElementValue = nanoDonationAmountElement.value * 1
      var nanoDonationAmount = nanoDonationAmountElementValue * raiMultiplier
      var token

      if (amountValid) {
        showPage(pageBrainblocks, false, false)

        // Render the Nano button
        brainblocks.Button.render({
          // Pass in payment options
          payment: {
            currency: 'rai',
            amount: nanoDonationAmount,
            destination: nanoAddress
          },
          // Handle successful payments
          onPayment: function (data) {
            token = data.token

            fetch ('https://api.brainblocks.io/api/session/' + token + '/verify', {
              method: 'get'
            })
            .then(function (response) {
              return response.json()
            })
            .then(function (data) {
              // Check whether Brainblocks response matches our existing values
              if (
                nanoDonationAmount === data.amount_rai &&
                nanoAddress === data.destination &&
                token === data.token
              ) {
                // Build up latest donation
                var latestDonation = {
                  timestamp: Date.now(),
                  amount: nanoDonationAmountElementValue,
                  url: url,
                  sender: data.sender,
                  destination: data.destination,
                  send_block: data.send_block,
                  brainblocks_token: data.token
                }

                $('nano-donation-amount-success').innerText = '⋰·⋰ ' + nanoDonationAmountElementValue

                donationSuccessfulDetailsElement.innerHTML= `
                  <table id="donation-history-item">
                    <tr>
                      <td>Date</td>
                      <td>${new Date(latestDonation.timestamp).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>Amount Donated</td>
                      <td>⋰·⋰ ${latestDonation.amount}</td>
                    </tr>
                    <tr>
                      <td>Donated To</td>
                      <td><a href="${latestDonation.url}" target="_blank">${latestDonation.url}</a></td>
                    </tr>
                    <tr>
                      <td>Sender Address</td>
                      <td><a href="${nanoCrawlerAccountURL + latestDonation.sender}" target="_blank">${latestDonation.sender}</a></td>
                    </tr>
                    <tr>
                      <td>Destination Address</td>
                      <td><a href="${nanoCrawlerAccountURL + latestDonation.destination}" target="_blank">${latestDonation.destination}</a></td>
                    </tr>
                    <tr>
                      <td>Send Block</td>
                      <td><a href="${nanoCrawlerBlockURL + latestDonation.send_block}" target="_blank">${latestDonation.send_block}</a></td>
                    </tr>
                    <!--tr>
                      <td>Brainblocks Token</td>
                      <td>${latestDonation.brainblocks_token}</td>
                    </tr-->              
                  </table>
                `

                showPage(pageDonationSuccessful)

                // Save donation to sync storage, along with previous donations
                chrome.storage.local.get({history: []}, function (keys) {
                  chrome.storage.local.set({history: [latestDonation, ...keys.history]})
                })
              } else {
                throw new Error('Payment error')
              }
            })
            .catch(function (error) {
              showPage(pageDonationUnsuccessful)
              console.log(error)
            })
          }
        }, '#nano-button')
      }
    }

    // -----

    function nanoDonationAmountChanged (event) {
      var amount = event.target.value.trim()
      var maxAmount = 99
      var minAmount = 0.0001
      var warnAmount = 50

      // Handle 'Next' button status and possible error text for entered Nano amount
      if (amount === '') {
        nextDisallow()
      } else if (amount === 0) {
        nextDisallow()
      } else if (!validNanoAddress.test(amount)) {
        nextDisallow('Invalid amount')
      } else if (amount > maxAmount) {
        nextDisallow('Maximum donation is ' + maxAmount + ' Nano. Choose smaller amount.')
      } else if (amount < minAmount) {
        nextDisallow('Minimum donation is ' + minAmount + ' Nano. Choose larger amount.')
      } else if (amount > warnAmount) {
        nextAllow('Donating more than ' + warnAmount + ' Nano, are you sure?')
      } else {
        nextAllow()
      }
    }

    // -----

    function showPage (page, footerActive = true, historyActive = true) {
      $(pageBrainblocks).style.display = 'none'
      $(pageNoDonate).style.display = 'none'
      $(pageDonation).style.display = 'none'
      $(pageHistory).style.display = 'none'
      $(pageDonationSuccessful).style.display = 'none'
      $(pageDonationUnsuccessful).style.display = 'none'
      $(page).style.display = 'block'

      // Check whether to activate the link to Nano Charts in the footer
      // (to prevent clicking away during the donation process)
      if (footerActive) {
        footerLinkNanocharts.innerHTML = '<a href="https://nanocharts.info/" target="_blank">Nano Charts</a>'
      } else {
        footerLinkNanocharts.innerHTML = 'Nano Charts'
      }

      // Check whether to activate the link to Donation History in the header
      // (to prevent clicking away during the donation process)
      if (historyActive) {
        historyLinkElement.style.display = 'block'
      } else {
        historyLinkElement.style.display = 'none'
      }
    }

      // -----

    function nextAllow (text = '') {
      nanoAmountErrorElement.innerText = text
      amountValid = true
      nanoDonationSubmitElement.disabled = false
    }

    // -----

    function nextDisallow (text = '') {
      nanoAmountErrorElement.innerText = text
      amountValid = false
      nanoDonationSubmitElement.disabled = true
    }

    // -----

    // Shorten long Nano address for display purposes
    function shortenNanoAddress (nanoAddress) {
      return nanoAddress.substring(0, 10) + '...' + nanoAddress.substring(58, 64)
    }

    // -----

    function setNanoAddress (element) {
      element.innerText = shortenNanoAddress(nanoAddress)
      element.href = nanoCrawlerAccountURL + nanoAddress
    }

    // -----

    function onSuggestionClicked (event) {
      nanoDonationAmountElement.value = event.target.title
      nextAllow()
    }

    // -----

    // Donation history
    function onHistoryLinkClicked (event) {
      var donationsHistoryHtml = ''

      // Get history of donations from sync storage
      chrome.storage.local.get({history: []}, function (keys) {
        keys.history.forEach(function (donation) {
          // Build HTML for this donation
          donationsHistoryHtml += `
            <table id="donation-history-item">
              <tr>
                <td>Date</td>
                <td>${new Date(donation.timestamp).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Amount Donated</td>
                <td>⋰·⋰ ${donation.amount}</td>
              </tr>
              <tr>
                <td>Donated To</td>
                <td><a href="${donation.url}" target="_blank">${donation.url}</a></td>
              </tr>
              <tr>
                <td>Sender Address</td>
                <td><a href="${nanoCrawlerAccountURL + donation.sender}" target="_blank">${donation.sender}</a></td>
              </tr>
              <tr>
                <td>Destination Address</td>
                <td><a href="${nanoCrawlerAccountURL + donation.destination}" target="_blank">${donation.destination}</a></td>
              </tr>
              <tr>
                <td>Send Block</td>
                <td><a href="${nanoCrawlerBlockURL + donation.send_block}" target="_blank">${donation.send_block}</a></td>
              </tr>
              <!--tr>
                <td>Brainblocks Token</td>
                <td>${donation.brainblocks_token}</td>
              </tr-->              
            </table>
          `
        })

        // If there are no donations insert default HTML
        donationsHistoryHtml = donationsHistoryHtml || '<p>You have not made any donations yet.</p>'

        donationsHistoryElement.innerHTML = donationsHistoryHtml
        showPage(pageHistory)
      })
    }
  })
})

// ---------------------------------------------------
// ---------------------------------------------------

function $ (name) {
  return document.getElementById(name)
}