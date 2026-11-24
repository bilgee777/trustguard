using TrustGuard.Api.Analyses;

namespace TrustGuard.Api.Tests;

public class RedactorTests
{
    [Theory]
    [InlineData("Call +90 532 123 45 67 now", "Call [phone] now")]
    [InlineData("Call (555) 123-4567 now", "Call [phone] now")]
    [InlineData("Call 0532 123 45 67 now", "Call [phone] now")]
    [InlineData("WhatsApp me on +44 7911 123456", "WhatsApp me on [phone]")]
    public void MasksPhoneNumbers(string input, string expected) => Assert.Equal(expected, Redactor.Redact(input));

    [Theory]
    [InlineData("Order total $350 per day")]
    [InlineData("Meeting on 2026-11-24 at 10:30")]
    [InlineData("Ticket 12345 and version 1.2.3")]
    [InlineData("Reply within 48 hours")]
    [InlineData("Send $49 fee to claim")]
    public void LeavesOrdinaryNumbersAlone(string input) => Assert.Equal(input, Redactor.Redact(input));

    [Fact]
    public void MasksCardNumbersOnlyWhenTheChecksumIsValid()
    {
        Assert.Equal("Card [card] expires soon", Redactor.Redact("Card 4111 1111 1111 1111 expires soon"));
        Assert.Equal("Card [card] expires soon", Redactor.Redact("Card 4111-1111-1111-1111 expires soon"));
        Assert.Equal("Card [card] expires soon", Redactor.Redact("Card 4111111111111111 expires soon"));
        Assert.DoesNotContain("[card]", Redactor.Redact("Reference 4111 1111 1111 1112 please"), StringComparison.Ordinal);
    }

    [Fact]
    public void MasksIbansOnlyWhenTheChecksumIsValid()
    {
        Assert.Equal("Pay to [iban] today", Redactor.Redact("Pay to GB82 WEST 1234 5698 7654 32 today"));
        Assert.Equal("Pay to [iban] today", Redactor.Redact("Pay to DE89370400440532013000 today"));
        Assert.DoesNotContain("[iban]", Redactor.Redact("Pay to GB82 WEST 1234 5698 7654 33 today"), StringComparison.Ordinal);
    }

    [Fact]
    public void MasksNationalIdentityNumbers()
    {
        Assert.Equal("SSN [id] on file", Redactor.Redact("SSN 123-45-6789 on file"));
        Assert.Equal("TC [id] dogrula", Redactor.Redact("TC 10000000146 dogrula"));
        // A number with a bad checksum is not an identity number, but it is still masked (as a phone-like number): over-redacting is safe.
        var invalid = Redactor.Redact("TC 10000000147 dogrula");
        Assert.DoesNotContain("[id]", invalid, StringComparison.Ordinal);
        Assert.DoesNotContain("10000000147", invalid, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("Your code is 482913", "Your code is [code]")]
    [InlineData("OTP: 1234", "OTP: [code]")]
    [InlineData("verification number 99887766", "verification number [code]")]
    [InlineData("Enter the PIN 5678 to continue", "Enter the PIN [code] to continue")]
    public void MasksOneTimeCodes(string input, string expected) => Assert.Equal(expected, Redactor.Redact(input));

    [Fact]
    public void KeepsTheDomainOfAnEmailAddressBecauseTheEngineChecksItForLookalikes()
    {
        Assert.Equal("Mail redacted@paypa1-support.com please", Redactor.Redact("Mail jane.doe+tag@paypa1-support.com please"));
    }

    [Fact]
    public void RemovesLinkSecretsButKeepsTheDestination()
    {
        Assert.Equal(
            "Open https://user:redacted@host.example/path?token=redacted&x=redacted now",
            Redactor.Redact("Open https://user:secret@host.example/path?token=abc123&x=1#frag now"));
        Assert.Equal("Go to https://a.example/login", Redactor.Redact("Go to https://a.example/login"));
    }

    [Fact]
    public void ALinkIsNeverMistakenForAnEmailAddress()
    {
        var result = Redactor.Redact("https://evil.example/?next=a@b.com");
        Assert.Equal("https://evil.example/?next=redacted", result);
    }

    [Fact]
    public void KeepsTheDecoyUsernameSoTheHiddenDestinationTrickStaysDetectable() =>
        Assert.Contains("www.paypal.com:redacted@login-check.example", Redactor.Redact("Visit https://www.paypal.com:pw123@login-check.example/"), StringComparison.Ordinal);

    [Fact]
    public void RedactingTwiceChangesNothing()
    {
        var samples = new[]
        {
            "Call +90 532 123 45 67, card 4111 1111 1111 1111, code: 482913, jane@acme.io, https://u:p@h.com/p?a=b",
            "IBAN GB82 WEST 1234 5698 7654 32 and SSN 123-45-6789",
            "Nothing sensitive here at all",
            "",
        };
        foreach (var sample in samples)
        {
            var once = Redactor.Redact(sample);
            Assert.Equal(once, Redactor.Redact(once));
        }
    }

    [Fact]
    public void NeverThrowsOnHostileInput()
    {
        var random = new Random(7);
        string[] pieces = ["+", "(", ")", "-", " ", "0", "1", "9", "@", ".", "com", "http://", "https://", "?", "=", "&", "#", "code", ":", "IBAN", "GB82", "\n", "%", "a"];
        for (var i = 0; i < 3000; i++)
        {
            var text = string.Concat(Enumerable.Range(0, random.Next(1, 40)).Select(_ => pieces[random.Next(pieces.Length)]));
            _ = Redactor.Redact(text);
        }
    }

    [Theory]
    [InlineData("4111111111111111", true)]
    [InlineData("5500 0000 0000 0004", true)]
    [InlineData("4111111111111112", false)]
    [InlineData("1111111111111111", false)]
    [InlineData("123456789012", false)]
    public void LuhnChecksumMatchesKnownCardNumbers(string number, bool valid) => Assert.Equal(valid, Redactor.PassesLuhn(number));
}
