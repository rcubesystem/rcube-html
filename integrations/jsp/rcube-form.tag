<%--
  rcube-html for JSP: writes a <rcube-form> with its schema into the page; the form is drawn in the browser.

  Setup (once)
    1. Copy this file to   src/main/webapp/WEB-INF/tags/rcube/rcube-form.tag
    2. Copy the script     node_modules/rcube-html/dist/browser/rcube-html.js  (or rcube-html.core.js: forms only)
       to your static files, e.g. src/main/webapp/static/rcube-html/rcube-html.js
       (or use a CDN: https://cdn.jsdelivr.net/npm/rcube-html@0.8.0/dist/browser/rcube-html.js)
    3. Keep schemas as JSON files the web app can read, e.g. src/main/webapp/WEB-INF/schemas/signup.json —
       the same files a React, Angular or Vue app can use.

  Use (Java 9+)
    <%@ taglib prefix="rc" tagdir="/WEB-INF/tags/rcube" %>
    <rc:rcube-form id="signup" schemaFile="/WEB-INF/schemas/signup.json" values="${signupJson}" actions="signupActions">
      <p>Loading the form…</p>          (shown until the form starts, and when JavaScript is off)
    </rc:rcube-form>
    <script src="${pageContext.request.contextPath}/static/rcube-html/rcube-html.js"></script>
    <script>
      // actions the schema names ("onClick": "save()"): each gets (event, context, api)
      window.signupActions = {
        save: function (event, context, api) {
          var entries = api.runValidation();              // nothing when a field isn't valid (errors are shown)
          if (!entries) return;
          fetch("signup", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entries[0]) });
        }
      };
      // or listen for the form's events
      document.getElementById("signup").addEventListener("rcube-submit", function (e) { console.log(e.detail.values); });
    </script>

  Attributes
    schema       the schema as JSON text (e.g. from Jackson: new ObjectMapper().writeValueAsString(schema))
    schemaFile   a JSON file of the web app (/WEB-INF/…): a schema (a list) or { "schema": […], "buttons": […], … }
    schemaSrc    a URL the browser fetches the schema from (a schema or a config object)
    buttons, values, messages, languages, data    JSON text, each optional
    actions      the name of a global object holding the actions the schema names (window.signupActions)
    language, repeatable, id, cssClass, style
--%>
<%@ tag description="rcube-html form (<rcube-form>)" pageEncoding="UTF-8" body-content="scriptless" trimDirectiveWhitespaces="true" %>
<%@ tag import="java.io.InputStream, java.nio.charset.StandardCharsets" %>
<%@ attribute name="id" required="false" %>
<%@ attribute name="cssClass" required="false" %>
<%@ attribute name="style" required="false" %>
<%@ attribute name="schema" required="false" %>
<%@ attribute name="schemaFile" required="false" %>
<%@ attribute name="schemaSrc" required="false" %>
<%@ attribute name="buttons" required="false" %>
<%@ attribute name="values" required="false" %>
<%@ attribute name="messages" required="false" %>
<%@ attribute name="languages" required="false" %>
<%@ attribute name="data" required="false" %>
<%@ attribute name="actions" required="false" %>
<%@ attribute name="language" required="false" %>
<%@ attribute name="repeatable" required="false" type="java.lang.Boolean" %>
<%!
  // An attribute value, escaped
  private static String attr(String name, String value) {
    if (value == null || value.isEmpty()) return "";
    return " " + name + "=\"" + value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;").replace(">", "&gt;") + "\"";
  }

  // JSON inside <script>: "</script>" in a text can't end the element early
  private static String json(String part, String value) {
    if (value == null || value.trim().isEmpty()) return "";
    String safe = value.replace("</", "<\\/")
        .replace(String.valueOf((char) 0x2028), "\\u2028")
        .replace(String.valueOf((char) 0x2029), "\\u2029");
    return "<script type=\"application/json\" data-rcube=\"" + part + "\">" + safe + "</script>";
  }
%>
<%
  String fileJson = null;
  if (schemaFile != null && !schemaFile.isEmpty()) {
    try (InputStream in = application.getResourceAsStream(schemaFile)) {
      if (in == null) throw new JspException("rcube-form: " + schemaFile + " isn't in the web app");
      fileJson = new String(in.readAllBytes(), StandardCharsets.UTF_8);
    } catch (java.io.IOException e) {
      throw new JspException("rcube-form: " + schemaFile + " couldn't be read", e);
    }
  }
  StringBuilder html = new StringBuilder("<rcube-form");
  html.append(attr("id", id)).append(attr("class", cssClass)).append(attr("style", style))
      .append(attr("schema-src", schemaSrc)).append(attr("actions", actions)).append(attr("language", language));
  if (Boolean.TRUE.equals(repeatable)) html.append(" repeatable");
  html.append(">");
  // a schema file may be a config ({ "schema": …, "buttons": … }) or a schema (a list): "config" reads both
  html.append(json("config", fileJson)).append(json("schema", schema)).append(json("buttons", buttons))
      .append(json("values", values)).append(json("messages", messages)).append(json("languages", languages))
      .append(json("data", data));
  out.write(html.toString());
%>
<jsp:doBody/>
<% out.write("</rcube-form>"); %>
